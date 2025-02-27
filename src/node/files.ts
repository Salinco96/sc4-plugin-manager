import type { Stats } from "node:fs"
import fs, { type FileHandle } from "node:fs/promises"
import path from "node:path"

import { type Path, glob } from "glob"

export type FileExtension = `.${string}`

export enum FileOpenMode {
  READ = "r",
  READWRITE = "r+",
  WRITE = "w",
}

/**
 * Copies the file or directory from {@link fullPath} to {@link targetPath}.
 * - By default, throws if the target file or directory already exists.
 * - If only `overwrite` is enabled, the target file or directory is fully deleted before copying.
 * - If only `merge` is enabled, directory contents are merged, existing subfiles being silently ignored
 * - If `merge` and `overwrite` are both enabled, directory contents are merged, existing files being fully replaced
 * @throws if {@link fullPath} does not exist
 * @throws if {@link targetPath} exists, unless `merge` or `overwrite` is enabled
 */
export async function fsCopy(
  fullPath: string,
  targetPath: string,
  options?: { merge?: boolean; overwrite?: boolean },
): Promise<void> {
  // Ensure source exists
  const stat = await fs.stat(fullPath)

  // Ensure target directory exists
  await fs.mkdir(path.dirname(targetPath), { recursive: true })

  // Copy source to target
  if (stat.isFile()) {
    await fs.copyFile(
      fullPath,
      targetPath,
      options?.overwrite ? undefined : fs.constants.COPYFILE_EXCL,
    )
  } else if (options?.merge) {
    // Copy individual files rather than whole directory
    const subfilePaths = await fsQueryFiles(fullPath, "**")
    for (const subfilePath of subfilePaths) {
      const subfileFullPath = path.resolve(fullPath, subfilePath)
      const subfileTargetPath = path.resolve(targetPath, subfilePath)

      if (!options.overwrite && (await fsExists(subfileTargetPath))) {
        continue
      }

      // Ensure target directory exists
      await fs.mkdir(path.dirname(subfileTargetPath), { recursive: true })

      // Copy subfile
      await fs.copyFile(subfileFullPath, subfileTargetPath)
    }
  } else {
    await fs.cp(fullPath, targetPath, {
      errorOnExist: !options?.overwrite,
      force: !!options?.overwrite,
      recursive: true,
    })
  }
}

/**
 * Creates a directory, recursively if needed. Does *not* fail if the directory already exists.
 */
export async function fsCreate(fullPath: string): Promise<void> {
  await fs.mkdir(fullPath, { recursive: true })
}

/**
 * Checks whether a file exists.
 */
export async function fsExists(fullPath: string): Promise<boolean> {
  try {
    await fs.access(fullPath)
    return true
  } catch (_) {
    return false
  }
}

/**
 * Moves the file or directory from {@link fullPath} to {@link targetPath}.
 * @throws if {@link fullPath} does not exist
 * @throws if {@link targetPath} exists, unless `overwrite` is enabled (in that case, the destination is fully deleted)
 */
export async function fsMove(
  fullPath: string,
  targetPath: string,
  options?: { overwrite?: boolean },
): Promise<void> {
  // Ensure source exists
  await fs.access(fullPath)

  // Ensure target directory exists
  await fsCreate(path.dirname(targetPath))

  // Ensure target does not exist unless `overwrite` is enabled
  if (!options?.overwrite) {
    await fs.mkdir(targetPath)
  }

  // Move source to target
  await fs.rename(fullPath, targetPath)
}

export async function fsOpen<T>(
  fullPath: string,
  mode: FileOpenMode,
  handler: (file: FileHandle) => Promise<T>,
): Promise<T> {
  const file = await fs.open(fullPath, mode)

  try {
    return await handler(file)
  } finally {
    await file.close()
  }
}

/**
 * Queries subdirectories within {@link basePath} (including recursively) using a glob pattern.
 */
export async function fsQueryDirectories(
  basePath: string,
  include: string | string[],
  options?: {
    exclude?: string | string[]
  },
): Promise<string[]> {
  const patterns = (Array.isArray(include) ? include : [include]).map(pattern =>
    pattern.endsWith("/") ? pattern : `${pattern}/`,
  )

  return glob(patterns, {
    cwd: basePath,
    dot: true,
    ignore: options?.exclude,
    posix: true,
  })
}

/**
 * Queries files within {@link basePath} (including recursively) using a glob pattern.
 */
export async function fsQueryFiles(
  basePath: string,
  include?: string | string[],
  options?: {
    exclude?: string | string[]
  },
): Promise<string[]> {
  return glob(include ?? "**", {
    cwd: basePath,
    dot: true,
    ignore: options?.exclude,
    nodir: true,
    posix: true,
  })
}

/**
 * Queries files within {@link basePath} (including recursively) using a glob pattern.
 */
export async function fsQueryFilesWithTypes(
  basePath: string,
  include?: string | string[],
  options?: {
    exclude?: string | string[]
  },
): Promise<Path[]> {
  return glob(include ?? "**", {
    cwd: basePath,
    dot: true,
    ignore: options?.exclude,
    nodir: true,
    withFileTypes: true,
  })
}

export function fsRead(fullPath: string): Promise<string> {
  return fs.readFile(fullPath, "utf8")
}

/**
 * Deletes a file or directory (even if not empty). Does *not* fail if the file or directory does not exist.
 * @returns `true` is the file or directory was deleted, `false` if it was not empty or did not exist
 */
export async function fsRemove(fullPath: string): Promise<boolean> {
  try {
    await fs.rm(fullPath, { recursive: true })
    return true
  } catch (error) {
    if (isErrorCode(error, "ENOENT")) {
      return false
    }

    throw error
  }
}

/**
 * Deletes a directory, only if it is empty. Does *not* fail if the directory is empty or does not exist.
 * @returns `true` is the directory was deleted, `false` if it was not empty or did not exist
 */
export async function fsRemoveIfEmpty(fullPath: string): Promise<boolean> {
  try {
    await fs.rmdir(fullPath)
    return true
  } catch (error) {
    if (isErrorCode(error, "ENOENT") || isErrorCode(error, "ENOTEMPTY")) {
      return false
    }

    throw error
  }
}

/**
 * Deletes empty directories recursively up to {@link basePath}.
 */
export async function fsRemoveIfEmptyRecursive(fullPath: string, basePath: string): Promise<void> {
  let currentPath = fullPath

  while (isChildPath(currentPath, basePath)) {
    try {
      await fs.rmdir(currentPath)
    } catch (error) {
      if (isErrorCode(error, "ENOENT")) {
        // Continue
      } else if (isErrorCode(error, "ENOTEMPTY")) {
        return
      } else {
        throw error
      }
    }

    currentPath = path.dirname(currentPath)
  }
}

export async function fsStat(fullPath: string): Promise<Stats | null> {
  try {
    return await fs.stat(fullPath)
  } catch (error) {
    if (isErrorCode(error, "ENOENT")) {
      return null
    }

    throw error
  }
}

/**
 * Creates a symbolic link to {@link targetPath} at {@link fullPath}.
 * @throws if {@link targetPath} does not exist
 * @throws if {@link fullPath} exists, unless `overwrite` is enabled (in that case, the destination is fully deleted)
 */
export async function fsSymlink(
  targetPath: string,
  fullPath: string,
  options?: { overwrite?: boolean },
): Promise<void> {
  // Ensure target exists
  await fs.access(targetPath)

  // Ensure parent directory exists
  await fsCreate(path.dirname(fullPath))

  if (options?.overwrite) {
    await fs.rm(fullPath, { force: true })
  }

  // Create a symbolic link to target
  await fs.symlink(targetPath, fullPath)
}

export async function fsWrite(
  fullPath: string,
  data: string,
  encoding: BufferEncoding = "utf8",
): Promise<void> {
  // Ensure parent directory exists
  await fsCreate(path.dirname(fullPath))

  // Write file
  await fs.writeFile(fullPath, data, encoding)
}

export function getExtension(filePath: string): FileExtension | "" {
  return path.extname(filePath).toLowerCase() as FileExtension | ""
}

export function getFilename(filePath: string, options?: { extension?: boolean }): string {
  return path.basename(filePath, options?.extension === false ? path.extname(filePath) : undefined)
}

export async function getFileSize(fullPath: string): Promise<number> {
  const stats = await fs.stat(fullPath)
  return stats.size
}

export async function getFileVersion(fullPath: string): Promise<number> {
  const stats = await fs.stat(fullPath)
  return stats.mtimeMs
}

/**
 * Checks if an absolute path is a child of another
 * @returns `true` if {@link fullPath} is a child (or subchild) of {@link basePath}, `false` otherwise
 */
export function isChildPath(fullPath: string, basePath: string): boolean {
  const relative = path.relative(basePath, fullPath)
  return (
    !!relative &&
    relative !== ".." &&
    !relative.startsWith("../") &&
    !relative.startsWith("..\\") &&
    !path.isAbsolute(relative)
  )
}

/**
 * Checks whether an absolute path represents a directory. Returns `false` if the path does not exist.
 * @returns `true` if {@link fullPath} is a directory, `false` otherwise
 */
export async function isDirectory(fullPath: string): Promise<boolean> {
  const stats = await fsStat(fullPath)
  return !!stats?.isDirectory()
}

export function isErrorCode(error: unknown, code: "ENOENT" | "ENOTEMPTY"): boolean {
  return error instanceof Error && "code" in error && error.code === code
}

/**
 * Checks whether an absolute path represents a symbolic link. Returns `false` if the path does not exist.
 * @returns `true` if {@link fullPath} is a symbolic link, `false` otherwise
 */
export async function isSymlink(fullPath: string): Promise<boolean> {
  const stats = await fsStat(fullPath)
  return !!stats?.isSymbolicLink()
}

export function isURL(filePath: string): boolean {
  return /^[a-z]+:[/][/]/.test(filePath)
}

/**
 * @returns the normalized joined relative path, in POSIX format
 */
export function joinPosix(...paths: string[]): string {
  return path.posix.join(...paths)
}

export async function readBytes(file: FileHandle, size?: number, offset?: number): Promise<Buffer> {
  if (size === undefined) {
    const { buffer } = await file.read({ position: offset })
    return buffer
  }

  const buffer = Buffer.alloc(size)
  await file.read(buffer, 0, size, offset)
  return buffer
}

export async function readFileIfPresent(fullPath: string): Promise<string | undefined> {
  try {
    return await fsRead(fullPath)
  } catch (error) {
    if (error instanceof Error && error.message.match(/no such file or directory/i)) {
      return undefined
    }

    throw error
  }
}

export function removeExtension(filePath: string): string {
  const extension = getExtension(filePath)
  return extension ? filePath.slice(0, -extension.length) : filePath
}

export function replaceExtension(filePath: string, extension: string): string {
  return `${removeExtension(filePath)}${extension}`
}

export function toPosix(filePath: string): string {
  return filePath.replaceAll(path.sep, path.posix.sep)
}

export async function writeBytes(
  file: FileHandle,
  buffer: Buffer,
  offset?: number,
): Promise<number> {
  const { bytesWritten } = await file.write(buffer, 0, buffer.length, offset)
  return bytesWritten
}
