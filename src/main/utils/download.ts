import { createWriteStream } from "fs"
import fs from "fs/promises"
import path from "path"
import { Readable } from "stream"
import { finished } from "stream/promises"
import { ReadableStream } from "stream/web"

import { parse as parseContentDisposition } from "content-disposition"
import { Extract as zipExtract } from "unzipper"

export async function download(key: string, url: string, downloadPath: string): Promise<void> {
  console.debug(`Downloading ${key} from ${url}...`)

  // TODO: Authenticate to Simtropolis to avoid daily limits
  const response = await fetch(url)

  const contentDisposition = response.headers.get("Content-Disposition")
  const contentType = response.headers.get("Content-Type")

  if (!response.ok) {
    // Log JSON response (may be an error response)
    if (contentType === "application/json") {
      console.warn(await response.json())
    }

    throw Error(`Failed to download ${key} - Unexpected response code: ${response.status}`)
  }

  if (!response.body) {
    throw Error(`Failed to download ${key} - Failed to fetch`)
  }

  let filename: string | undefined

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
  if (filename.endsWith(".zip")) {
    try {
      await finished(stream.pipe(zipExtract({ path: downloadPath })))
    } catch (error) {
      if (!(error instanceof Error) || !error.message.match(/premature close/i)) {
        throw error
      }
    }
    // TODO: Remove annoying extra nesting that some zip archives include
  } else {
    await fs.mkdir(downloadPath, { recursive: true })
    await finished(stream.pipe(createWriteStream(path.join(downloadPath, filename))))
  }

  console.debug(`Downloaded ${key}`)
}
