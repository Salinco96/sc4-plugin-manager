import { createWriteStream } from "fs"
import { readdir, rename } from "fs/promises"
import path from "path"
import { pipeline } from "stream"
import { finished } from "stream/promises"

import { glob } from "glob"
import { Open } from "unzipper"

import { createIfMissing, getExtension, removeIfPresent } from "./files"
import { cmd } from "./processes"
import { TaskContext } from "./tasks"

export async function extract(
  context: TaskContext<{
    runTool(tool: "7z" | "cicdec", ...args: string[]): Promise<string>
  }>,
  downloadPath: string,
  onProgress: (bytes: number, totalBytes: number) => void,
): Promise<void> {
  const archivePaths = await glob("*.{exe,jar,zip}", {
    cwd: downloadPath,
    matchBase: true,
    nodir: true,
  })

  if (archivePaths.length) {
    for (const archivePath of archivePaths) {
      context.debug(`Extracting from ${archivePath}`)
      const extension = getExtension(archivePath)
      const archiveFullPath = path.join(downloadPath, archivePath)
      const extractFullPath = path.join(downloadPath, path.dirname(archivePath))
      if (extension === ".exe") {
        await extractEXE(context, archiveFullPath, extractFullPath)
      } else if (extension === ".jar") {
        await extractArchive(context, archiveFullPath, extractFullPath, onProgress, filePath => {
          // For .jar archives, extract only the contents of "installation" folder
          if (filePath.startsWith("installation/")) {
            return filePath.slice("installation/".length)
          } else {
            return null
          }
        })
      } else {
        await extractArchive(context, archiveFullPath, extractFullPath, onProgress)
      }

      // Delete the archive after successful extraction
      await removeIfPresent(path.join(downloadPath, archivePath))
    }

    // In case there are nested archives...
    await extract(context, downloadPath, onProgress)
  }
}

export async function extractArchive(
  context: TaskContext,
  archivePath: string,
  extractPath: string,
  onProgress: (bytes: number, totalBytes: number) => void,
  transform?: (filePath: string) => string | null,
): Promise<void> {
  const archive = await Open.file(archivePath)
  const files = archive.files.filter(file => file.type === "File")

  const totalUncompressedSize = files.reduce((total, file) => total + file.uncompressedSize, 0)

  onProgress(0, totalUncompressedSize)

  let bytes = 0
  for (const file of files) {
    const transformedPath = transform ? transform(file.path) : file.path
    if (!transformedPath) {
      continue
    }

    context.debug(`Extracting ${file.path}`)
    const targetPath = path.join(extractPath, transformedPath)
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

export async function extractEXE(
  context: TaskContext<{
    runTool(tool: "7z" | "cicdec", ...args: string[]): Promise<string>
  }>,
  archivePath: string,
  extractPath: string,
): Promise<void> {
  try {
    // Try to extract ClickTeam installer
    await context.extra.runTool("cicdec", archivePath, extractPath)
  } catch (error) {
    // Try to extract with 7zip
    await context.extra.runTool("7z", "e", `-o${extractPath}`, archivePath)
  }
}

export async function extractMSI(
  context: TaskContext,
  archivePath: string,
  extractPath: string,
): Promise<void> {
  // If installer is "foo/bar/baz.msi", extract to "foo/bar/~baz"
  const tempName = `~${path.basename(archivePath, path.extname(archivePath))}`
  const tempPath = path.join(path.dirname(archivePath), tempName)

  await cmd(`msiexec /a "${archivePath}" TARGETDIR="${tempPath}" /qn`)

  // For .msi installers, extract only the contents of "Files" folder
  for (const entryPath of await readdir(path.join(tempPath, "Files"))) {
    await rename(path.join(tempPath, "Files", entryPath), path.join(extractPath, entryPath))
  }

  await removeIfPresent(tempPath)
}
