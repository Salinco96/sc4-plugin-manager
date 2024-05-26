import { createWriteStream } from "fs"

import path from "path"
import { Readable, pipeline } from "stream"
import { finished } from "stream/promises"
import { ReadableStream } from "stream/web"

import { parse as parseContentDisposition } from "content-disposition"
import { Open } from "unzipper"
import { glob } from "glob"
import { createIfMissing, removeIfPresent } from "./files"

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
    // TODO: Unzipping directly from stream is faster but some JAR files become corrupted...
    // if (true) {
    const archivePath = path.join(downloadPath, filename)
    await writeFromStream(stream, archivePath)
    await extractArchive(archivePath, downloadPath)
    await removeIfPresent(archivePath)
    // } else {
    //   await extractFromStream(stream, downloadPath)
    // }

    // TODO: Remove annoying extra nesting that some zip archives include
  } else {
    await writeFromStream(stream, path.join(downloadPath, filename))
  }

  console.debug(`Downloaded ${key}`)
}

export async function extract(downloadPath: string): Promise<void> {
  const archivePaths = await glob("*.{jar,zip}", {
    cwd: downloadPath,
    matchBase: true,
    nodir: true,
  })

  // Extract archives
  for (const archivePath of archivePaths) {
    console.log(`Extracting from ${archivePath}`)
    const extractPath = path.join(downloadPath, archivePath.replace(/\.(jar|zip)$/, ""))

    // Extract only supported files
    const pattern = /\.(dat|dll|SC4Desc|SC4Lot|SC4Model|_LooseDesc)$/
    await extractArchive(path.join(downloadPath, archivePath), extractPath, pattern)
    await removeIfPresent(path.join(downloadPath, archivePath))
  }
}

async function extractArchive(
  archivePath: string,
  extractPath: string,
  pattern?: RegExp,
): Promise<void> {
  const archive = await Open.file(archivePath)
  for (const file of archive.files) {
    if (file.type === "File" && (!pattern || file.path.match(pattern))) {
      console.debug(`Extracting ${file.path}`)
      const targetPath = path.join(extractPath, file.path)
      await createIfMissing(path.dirname(targetPath))
      try {
        await finished(
          pipeline(file.stream(), createWriteStream(targetPath), error => {
            if (error) {
              console.error(`Failed to extract ${file.path}`, error)
            }
          }),
        )
      } catch (error) {
        console.error(`Failed to extract ${file.path}`, error)
        await removeIfPresent(targetPath)
        throw error
      }
    }
  }
}

// async function extractFromStream(stream: Readable, extractPath: string): Promise<void> {
//   try {
//     await finished(stream.pipe(Extract({ path: extractPath })))
//   } catch (error) {
//     if (!(error instanceof Error) || !error.message.match(/premature close/i)) {
//       throw error
//     }
//   }
// }

async function writeFromStream(stream: Readable, downloadPath: string): Promise<void> {
  await createIfMissing(path.dirname(downloadPath))
  await finished(stream.pipe(createWriteStream(downloadPath)))
}
