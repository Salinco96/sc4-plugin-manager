import { Hash, createHash } from "crypto"
import { createWriteStream } from "fs"
import path from "path"
import { Readable, Transform, TransformCallback } from "stream"
import { finished } from "stream/promises"
import { ReadableStream } from "stream/web"

import { parse as parseContentDisposition } from "content-disposition"

import { Logger } from "@common/logs"

import { extract7z, extractArchive, extractMSI } from "./extract"
import { createIfMissing, moveTo, removeIfPresent } from "./files"

// Transform stream to compute hash/progress as data is being downloaded
export class DownloadTransformStream extends Transform {
  public readonly hash: Hash
  public readonly onProgress: (bytes: number) => void
  public size: number = 0

  public constructor(onProgress: (bytes: number) => void) {
    super()
    this.hash = createHash("sha256")
    this.onProgress = onProgress
  }

  public override _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.hash.update(chunk)
    this.push(chunk)
    this.size += chunk.length
    this.onProgress(this.size)
    callback()
  }

  public sha256(): string {
    return this.hash.digest("hex")
  }
}

export async function download(
  response: Response,
  options: {
    downloadPath: string
    downloadTempPath?: string
    exePath?(exe: string): Promise<string>
    expectedHash?: string
    expectedSize?: number
    logger?: Logger
    onProgress?(current: number, total: number): void
  },
): Promise<{ sha256: string; size: number; uncompressedSize?: number }> {
  const {
    downloadPath,
    downloadTempPath = downloadPath,
    expectedHash,
    logger = console,
    onProgress,
  } = options

  try {
    const contentDisposition = response.headers.get("Content-Disposition")
    const contentLength = response.headers.get("Content-Length")
    const contentType = response.headers.get("Content-Type")

    // TODO: Detect Simtropolis daily limit and request for login

    if (!response.ok) {
      if (contentType === "application/json") {
        logger.warn(JSON.parse(await response.json()))
      }

      throw Error(`Unexpected response code ${response.status}`)
    }

    if (!response.body) {
      throw Error("Empty body")
    }

    let expectedSize = options.expectedSize
    let filename: string | undefined

    if (contentLength) {
      const actualSize = Number.parseInt(contentLength, 10)
      if (expectedSize && expectedSize !== actualSize) {
        throw Error(`Expected ${expectedSize} bytes but received ${actualSize}`)
      }

      expectedSize = actualSize
    }

    // Read filename from Content-Disposition header
    if (contentDisposition) {
      filename = parseContentDisposition(contentDisposition).parameters.filename
    }

    // Otherwise, try to infer the extension from Content-Type
    if (!filename) {
      const extension = contentType && inferExtensionFromContentType(contentType)
      if (!extension) {
        const message = `Unexpected Content-Disposition "${contentDisposition}" and Content-Type "${contentType}"`
        throw Error(message)
      }

      filename = options.downloadPath + extension
    }

    const stream = Readable.fromWeb(response.body as ReadableStream)
    const downloadTempFile = path.join(downloadTempPath, filename)

    if (onProgress && expectedSize) {
      onProgress(0, expectedSize)
    }

    const transform = new DownloadTransformStream(bytes => {
      if (onProgress && expectedSize) {
        onProgress(bytes, Math.max(bytes, expectedSize))
      }
    })

    await createIfMissing(downloadTempPath)
    await finished(stream.pipe(transform).pipe(createWriteStream(downloadTempFile)))

    const actualHash = transform.sha256()
    const actualSize = transform.size

    let uncompressedSize: number | undefined

    logger.debug(`SHA-256: ${actualHash} (${actualSize} bytes)`)

    // TODO: Download URLs from Simtropolis/SC4Evermore are not versioned - this means that if/when they
    // release a new version (therefore using the same URL), this strict length/hash integrity check will
    // fail until the Manager DB is updated (which in low activity periods could take days/weeks). Thus it
    // may make more sense to treat this as a warning, rather than failing the download.
    if (expectedSize && expectedSize !== actualSize) {
      throw Error(`Expected ${expectedSize} bytes but received ${actualSize}`)
    }

    // TODO: Same as above
    if (expectedHash && expectedHash !== actualHash) {
      throw Error(`Expected SHA-256 ${expectedHash}`)
    }

    if (filename.endsWith(".7z")) {
      const { size } = await extract7z(downloadTempFile, downloadTempPath, options)
      await removeIfPresent(downloadTempFile)
      uncompressedSize = size
    }

    if (filename.endsWith(".msi")) {
      await extractMSI(downloadTempFile, downloadTempPath)
      await removeIfPresent(downloadTempFile)
    }

    if (filename.endsWith(".zip")) {
      const { size } = await extractArchive(downloadTempFile, downloadTempPath, options)
      await removeIfPresent(downloadTempFile)
      uncompressedSize = size
    }

    if (downloadPath !== downloadTempPath) {
      await createIfMissing(path.dirname(downloadPath))
      await moveTo(downloadTempPath, downloadPath)
    }

    logger.debug("Done")

    return { sha256: actualHash, size: actualSize, uncompressedSize }
  } catch (error) {
    await removeIfPresent(downloadTempPath)
    throw error
  }
}

function inferExtensionFromContentType(contentType: string): string | undefined {
  switch (contentType) {
    case "application/x-7z-compressed":
      return ".7z"

    case "application/x-zip":
    case "application/zip":
      return ".zip"
  }
}
