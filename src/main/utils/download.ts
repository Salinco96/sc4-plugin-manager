import { Hash, createHash } from "crypto"
import { net } from "electron/main"
import { createWriteStream } from "fs"
import { rename } from "fs/promises"
import path from "path"
import { Readable, Transform, TransformCallback, pipeline } from "stream"
import { finished } from "stream/promises"
import { ReadableStream } from "stream/web"

import { parse as parseContentDisposition } from "content-disposition"
import { glob } from "glob"
import { Open } from "unzipper"

import { createIfMissing, removeIfPresent } from "./files"
import {
  SIMTROPOLIS_ORIGIN,
  SimtropolisSession,
  getSimtropolisSessionHeaders,
} from "./sessions/simtropolis"
import { TaskContext } from "./tasks"

export class DownloadTransformStream extends Transform {
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
    // Log JSON response (may be an error response)
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

  // TODO: Download to tmp folder then move to downloadPath only when completed
  const targetPath = path.join(downloadTempPath, filename)

  try {
    if (expectedBytes) {
      onProgress(0, expectedBytes)
    }

    await writeFromStream(context, stream, targetPath, expectedBytes, exceptedHash, onProgress)

    if (filename.endsWith(".zip")) {
      await extractArchive(context, targetPath, downloadTempPath, undefined, onProgress)
      await removeIfPresent(targetPath)
      // TODO: Remove annoying extra nesting that some zip archives include
    }

    await createIfMissing(path.dirname(downloadPath))
    await rename(downloadTempPath, downloadPath)
  } finally {
    await removeIfPresent(downloadTempPath)
  }

  context.debug("Done")
}

export async function extract(
  context: TaskContext,
  downloadPath: string,
  onProgress: (bytes: number, totalBytes: number) => void,
): Promise<void> {
  // TODO: How to deal with .exe installers?
  const archivePaths = await glob("*.{jar,zip}", {
    cwd: downloadPath,
    matchBase: true,
    nodir: true,
  })

  if (archivePaths.length) {
    // Extract all supported archives
    for (const archivePath of archivePaths) {
      context.debug(`Extracting from ${archivePath}`)
      const extractPath = path.join(downloadPath, archivePath.replace(/\.(jar|zip)$/, ""))

      // Extract only supported files
      const pattern = /\.(dat|dll|SC4Desc|SC4Lot|SC4Model|_LooseDesc|zip)$/
      await extractArchive(
        context,
        path.join(downloadPath, archivePath),
        extractPath,
        pattern,
        onProgress,
      )
      await removeIfPresent(path.join(downloadPath, archivePath))
      // In case there are nested archives...
      await extract(context, extractPath, onProgress)
    }
  }
}

async function extractArchive(
  context: TaskContext,
  archivePath: string,
  extractPath: string,
  pattern: RegExp | undefined,
  onProgress: (bytes: number, totalBytes: number) => void,
): Promise<void> {
  const archive = await Open.file(archivePath)
  const files = archive.files.filter(file => {
    return file.type === "File" && pattern?.test(file.path) !== false
  })

  const totalUncompressedSize = files.reduce((total, file) => total + file.uncompressedSize, 0)

  onProgress(0, totalUncompressedSize)

  let bytes = 0
  for (const file of files) {
    context.debug(`Extracting ${file.path}`)
    const targetPath = path.join(extractPath, file.path)
    await createIfMissing(path.dirname(targetPath))
    try {
      await finished(
        pipeline(file.stream(), createWriteStream(targetPath), error => {
          if (error) {
            context.error(`Failed to extract ${file.path}`, error)
          }
        }),
      )

      bytes += file.uncompressedSize
      onProgress(bytes, totalUncompressedSize)
    } catch (error) {
      context.error(`Failed to extract ${file.path}`, error)
      await removeIfPresent(targetPath)
      throw error
    }
  }
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

  if (expectedBytes && expectedBytes !== actualBytes) {
    throw Error(`Expected ${expectedBytes} bytes but received ${actualBytes}`)
  }

  if (expectedHash && expectedHash !== actualHash) {
    throw Error(`Expected SHA-256 ${expectedHash}`)
  }

  return actualHash
}
