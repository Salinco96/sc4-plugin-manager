import console from "node:console"
import { createWriteStream } from "node:fs"
import { readdir } from "node:fs/promises"
import path from "node:path"
import { pipeline } from "node:stream"
import { finished } from "node:stream/promises"

import { Open } from "unzipper"

import type { Logger } from "@common/logs"
import type { ToolID } from "@common/tools"

import { fsCreate, fsMove, fsQueryFiles, fsRemove, getExtension } from "./files"
import { cmd, runFile } from "./processes"

export async function extractRecursively(
  basePath: string,
  options: {
    exePath(toolId: ToolID): Promise<string>
    isTool?: boolean
    logger?: Logger
    onProgress?(current: number, total: number): void
  },
): Promise<void> {
  const { logger = console } = options

  const archivePaths = await fsQueryFiles(basePath, "**/*.{7z,exe,jar,msi,rar,zip}", {
    exclude: options.isTool ? "**/*.exe" : "**/4gb_patch.exe",
  })

  if (archivePaths.length) {
    for (const archivePath of archivePaths) {
      const archiveFullPath = path.resolve(basePath, archivePath)

      // Skip OpenJDK (from the NAM download), $PLUGINSDIR (from the CAM download), 4GB Patch, etc.
      // TODO: Indicate this in package config somehow?
      if (archivePath.match(/(\$PLUGINSDIR|4gb_patch\.exe|install_lrm.+\.exe|openjdk.+\.msi)$/i)) {
        logger.debug(`Removing ${archivePath}...`)
      } else {
        logger.debug(`Extracting from ${archivePath}...`)
        const extractFullPath = path.resolve(basePath, path.dirname(archivePath))
        await extract(archiveFullPath, extractFullPath, options)
      }

      // Delete the archive after successful extraction
      await fsRemove(archiveFullPath)
    }

    // In case there are nested archives...
    await extractRecursively(basePath, options)
  }
}

export async function extract(
  archivePath: string,
  extractPath: string,
  options: {
    exePath(toolId: ToolID): Promise<string>
    logger?: Logger
    onProgress?(current: number, total: number): void
  },
): Promise<void> {
  const extension = getExtension(archivePath)

  switch (extension) {
    case ".7z":
    case ".rar":
      await extract7z(archivePath, extractPath, options)
      break

    case ".exe":
      // Try to extract ClickTeam installer, then fallback to 7-zip
      try {
        await extractClickTeam(archivePath, extractPath, options)
      } catch (_error) {
        console.error(_error)
        await extract7z(archivePath, extractPath, options)
      }
      break

    case ".jar":
      await extractArchive(archivePath, extractPath, {
        ...options,
        // For .jar archives, extract only the contents of "installation" folder
        transform(filePath) {
          if (filePath.startsWith("installation/")) {
            return filePath.replace("installation/", "")
          }

          return null
        },
      })
      break

    case ".msi":
      await extractMSI(archivePath, extractPath)
      break

    case ".zip":
      await extractArchive(archivePath, extractPath, options)
      break

    default:
      throw Error(`Unsupported archive format ${extension}`)
  }
}

export async function extract7z(
  archivePath: string,
  extractPath: string,
  options: {
    exePath(toolId: ToolID): Promise<string>
    logger?: Logger
  },
): Promise<{ size: number }> {
  const exePath = await options.exePath("7z" as ToolID)

  const stdout = await runFile(exePath, {
    args: ["x", "-y", `-o${extractPath}`, archivePath],
    ...options,
  })

  const sizeMatch = stdout.match(/size:\s*(\d+)/i)
  const size = sizeMatch ? Number.parseInt(sizeMatch[1], 10) : 0
  return { size }
}

export async function extractArchive(
  archivePath: string,
  extractPath: string,
  options: {
    logger?: Logger
    onProgress?(current: number, total: number): void
    transform?(filePath: string): string | null
  } = {},
): Promise<{ size: number }> {
  const { logger = console, onProgress, transform } = options

  const archive = await Open.file(archivePath)
  const files = archive.files.filter(file => file.type === "File")

  const totalUncompressedSize = files.reduce((total, file) => total + file.uncompressedSize, 0)

  if (onProgress) {
    onProgress(0, totalUncompressedSize)
  }

  let size = 0
  for (const file of files) {
    const transformedPath = transform ? transform(file.path) : file.path
    if (transformedPath) {
      logger.debug(`Extracting ${file.path}`)
      const targetPath = path.resolve(extractPath, transformedPath)
      await fsCreate(path.dirname(targetPath))
      try {
        await finished(
          pipeline(file.stream(), createWriteStream(targetPath), error => {
            if (error) {
              logger.error(`Failed to extract ${file.path}`, error)
            }
          }),
        )

        size += file.uncompressedSize

        if (onProgress) {
          onProgress(size, totalUncompressedSize)
        }
      } catch (error) {
        logger.error(`Failed to extract ${file.path}`, error)
        await fsRemove(targetPath)
        throw error
      }
    }
  }

  return { size }
}

export async function extractClickTeam(
  archivePath: string,
  extractPath: string,
  options: {
    exePath(toolId: ToolID): Promise<string>
    logger?: Logger
  },
): Promise<void> {
  const exePath = await options.exePath("cicdec" as ToolID)

  await runFile(exePath, {
    args: [archivePath, extractPath],
    ...options,
  })
}

export async function extractMSI(archivePath: string, extractPath: string): Promise<void> {
  // If installer is "foo/bar/baz.msi", extract to "foo/bar/~baz"
  const tempName = `~${path.basename(archivePath, path.extname(archivePath))}`
  const tempPath = path.resolve(path.dirname(archivePath), tempName)

  await cmd(`msiexec /a "${archivePath}" TARGETDIR="${tempPath}" /qn`)

  // For .msi installers, extract only the contents of "Files" folder
  for (const entryPath of await readdir(path.resolve(tempPath, "Files"))) {
    await fsMove(path.resolve(tempPath, "Files", entryPath), path.resolve(extractPath, entryPath))
  }

  await fsRemove(tempPath)
}
