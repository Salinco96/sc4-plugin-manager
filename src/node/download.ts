import { type Hash, createHash } from "node:crypto"
import { createWriteStream } from "node:fs"
import path from "node:path"
import { Readable, Transform, type TransformCallback } from "node:stream"
import { finished } from "node:stream/promises"
import type { ReadableStream } from "node:stream/web"

import { parse as parseContentDisposition } from "content-disposition"

import type { Logger } from "@common/logs"

import { extract7z, extractArchive, extractMSI } from "./extract"
import { createIfMissing, getExtension, moveTo, removeIfPresent } from "./files"

// Transform stream to compute hash/progress as data is being downloaded
export class DownloadTransformStream extends Transform {
  public readonly hash: Hash
  public readonly onProgress: (bytes: number) => void
  public size = 0

  public constructor(onProgress: (bytes: number) => void) {
    super()
    this.hash = createHash("sha256")
    this.onProgress = onProgress
  }

  public override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
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
    expectedSha256?: string
    expectedSize?: number
    logger?: Logger
    onProgress?(current: number, total: number): void
    url: string
  },
): Promise<{ filename: string; sha256: string; size: number; uncompressedSize?: number }> {
  const {
    downloadPath,
    downloadTempPath = downloadPath,
    expectedSha256,
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

      if (extension) {
        filename = path.basename(options.downloadPath) + extension
      }
    }

    // Otherwise, try to infer the filename from the URL
    if (!filename) {
      const lastPath = options.url.split("?").at(0)?.split("/").at(-1)
      if (lastPath?.includes(".")) {
        filename = lastPath
      }
    }

    // Otherwise, fail
    if (!filename) {
      const message = `Unexpected Content-Disposition "${contentDisposition}" and Content-Type "${contentType}"`
      throw Error(message)
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

    const sha256 = transform.sha256()
    const size = transform.size

    let uncompressedSize: number | undefined

    logger.debug(`SHA-256: ${sha256} (${size} bytes)`)

    // TODO: Download URLs from Simtropolis/SC4Evermore are not versioned - this means that if/when they
    // release a new version (therefore using the same URL), this strict length/hash integrity check will
    // fail until the Manager DB is updated (which in low activity periods could take days/weeks). Thus it
    // may make more sense to treat this as a warning, rather than failing the download.
    if (expectedSize && expectedSize !== size) {
      throw Error(`Expected ${expectedSize} bytes but received ${size}`)
    }

    // TODO: Same as above
    if (expectedSha256 && expectedSha256 !== sha256) {
      throw Error(`Expected SHA-256 ${expectedSha256}`)
    }

    const extension = getExtension(filename)
    if (extension === ".7z" || extension === ".rar") {
      const { size } = await extract7z(downloadTempFile, downloadTempPath, options)
      await removeIfPresent(downloadTempFile)
      uncompressedSize = size
    }

    if (extension === ".msi") {
      await extractMSI(downloadTempFile, downloadTempPath)
      await removeIfPresent(downloadTempFile)
    }

    if (extension === ".zip") {
      const { size } = await extractArchive(downloadTempFile, downloadTempPath, options).catch(() =>
        extract7z(downloadTempFile, downloadTempPath, options),
      )
      await removeIfPresent(downloadTempFile)
      uncompressedSize = size
    }

    if (downloadPath !== downloadTempPath) {
      await createIfMissing(path.dirname(downloadPath))
      await moveTo(downloadTempPath, downloadPath)
    }

    logger.debug("Done")

    return { filename, sha256, size, uncompressedSize }
  } catch (error) {
    await removeIfPresent(downloadTempPath)
    throw error
  }
}

function inferExtensionFromContentType(contentType: string): string | undefined {
  switch (contentType) {
    case "application/x-7z":
    case "application/x-7z-compressed":
      return ".7z"

    case "application/vnd.rar":
    case "application/x-rar":
    case "application/x-rar-compressed":
      return ".rar"

    case "application/zip":
    case "application/x-zip":
    case "application/x-zip-compressed":
    case "multipart/x-zip":
      return ".zip"
  }
}
