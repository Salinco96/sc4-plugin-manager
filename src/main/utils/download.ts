import { Hash, createHash } from "crypto"
import { net } from "electron/main"
import { createWriteStream } from "fs"
import { rename } from "fs/promises"
import path from "path"
import { Readable, Transform, TransformCallback } from "stream"
import { finished } from "stream/promises"
import { ReadableStream } from "stream/web"

import { parse as parseContentDisposition } from "content-disposition"

import { extractArchive, extractMSI } from "./extract"
import { createIfMissing, removeIfPresent } from "./files"
import {
  SIMTROPOLIS_ORIGIN,
  SimtropolisSession,
  getSimtropolisSessionHeaders,
} from "./sessions/simtropolis"
import { TaskContext } from "./tasks"

// Transform stream to compute hash/progress as data is being downloaded
class DownloadTransformStream extends Transform {
  public bytes: number = 0
  public readonly hash: Hash
  public readonly onProgress: (bytes: number) => void

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
    this.bytes += chunk.length
    this.onProgress(this.bytes)
    callback()
  }

  public sha256(): string {
    return this.hash.digest("hex")
  }
}

export async function download(
  context: TaskContext,
  key: string,
  url: string,
  downloadPath: string,
  downloadTempPath: string,
  expectedBytes: number | undefined,
  exceptedHash: string | undefined,
  sessions: {
    simtropolis?: SimtropolisSession | null
  },
  onProgress: (bytes: number, totalBytes: number) => void,
): Promise<void> {
  const { origin } = new URL(url)

  context.debug(`Downloading ${url}...`)

  let headers: HeadersInit | undefined

  if (origin === SIMTROPOLIS_ORIGIN && sessions.simtropolis) {
    headers = getSimtropolisSessionHeaders(sessions.simtropolis)
  }

  const response = await net.fetch(url, { credentials: "include", headers })

  const contentDisposition = response.headers.get("Content-Disposition")
  const contentLength = response.headers.get("Content-Length")
  const contentType = response.headers.get("Content-Type")

  // TODO: Detect Simtropolis daily limit and request for login

  if (!response.ok) {
    if (contentType === "application/json") {
      context.warn(await response.json())
    }

    throw Error(`Failed to download ${key} - Unexpected response code: ${response.status}`)
  }

  if (!response.body) {
    throw Error(`Failed to download ${key} - Failed to fetch`)
  }

  let filename: string | undefined

  if (contentLength) {
    expectedBytes = Number.parseInt(contentLength, 10) || expectedBytes
  }

  // Read filename from Content-Disposition header
  if (contentDisposition) {
    filename = parseContentDisposition(contentDisposition).parameters.filename
  }

  // Otherwise, try to infer at least the extension from Content-Type
  if (!filename) {
    if (contentType?.match(/^application\/(x-)?zip$/)) {
      filename = downloadPath + ".zip"
    } else {
      throw Error(`Failed to download ${key} - Unexpected response format: ${contentDisposition}`)
    }
  }

  const stream = Readable.fromWeb(response.body as ReadableStream)
  const targetPath = path.join(downloadTempPath, filename)

  try {
    if (expectedBytes) {
      onProgress(0, expectedBytes)
    }

    await writeFromStream(context, stream, targetPath, expectedBytes, exceptedHash, onProgress)

    if (filename.endsWith(".msi")) {
      await extractMSI(context, targetPath, downloadTempPath)
      await removeIfPresent(targetPath)
    }

    if (filename.endsWith(".zip")) {
      await extractArchive(context, targetPath, downloadTempPath, onProgress)
      await removeIfPresent(targetPath)
    }

    await createIfMissing(path.dirname(downloadPath))
    await rename(downloadTempPath, downloadPath)
  } finally {
    await removeIfPresent(downloadTempPath)
  }

  context.debug("Done")
}

async function writeFromStream(
  context: TaskContext,
  stream: Readable,
  downloadPath: string,
  expectedBytes: number | undefined,
  expectedHash: string | undefined,
  onProgress: (bytes: number, totalBytes: number) => void,
): Promise<string> {
  const transform = new DownloadTransformStream(bytes => {
    if (expectedBytes) {
      onProgress(bytes, Math.max(bytes, expectedBytes))
    }
  })

  await createIfMissing(path.dirname(downloadPath))
  await finished(stream.pipe(transform).pipe(createWriteStream(downloadPath)))

  const actualBytes = transform.bytes
  const actualHash = transform.sha256()

  context.debug(`SHA-256: ${actualHash} (${actualBytes} bytes)`)

  // TODO: Download URLs from Simtropolis/SC4Evermore are not versioned - this means that if/when they
  // release a new version (therefore using the same URL), this strict length/hash integrity check will
  // fail until the Manager DB is updated (which in low activity periods could take days/weeks). Thus it
  // may make more sense to treat this as a warning, rather than failing the download.
  if (expectedBytes && expectedBytes !== actualBytes) {
    throw Error(`Expected ${expectedBytes} bytes but received ${actualBytes}`)
  }

  // TODO: Same as above
  if (expectedHash && expectedHash !== actualHash) {
    throw Error(`Expected SHA-256 ${expectedHash}`)
  }

  return actualHash
}
