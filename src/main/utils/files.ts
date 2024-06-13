import fs from "fs/promises"
import path from "path"

export async function copyTo(fullPath: string, targetPath: string): Promise<void> {
  await createIfMissing(path.dirname(targetPath))
  await fs.copyFile(fullPath, targetPath)
}

export async function moveTo(fullPath: string, targetPath: string): Promise<void> {
  await createIfMissing(path.dirname(targetPath))
  try {
    await fs.rename(fullPath, targetPath)
  } catch (error) {
    await fs.copyFile(fullPath, targetPath)
    await fs.unlink(fullPath)
  }
}

export async function createIfMissing(fullPath: string): Promise<boolean> {
  try {
    await fs.mkdir(fullPath, { recursive: true })
    return true
  } catch (error) {
    if (error instanceof Error && error.message.match(/already exists/i)) {
      return false
    } else {
      throw error
    }
  }
}

export async function exists(fullPath: string): Promise<boolean> {
  try {
    await fs.stat(fullPath)
    return true
  } catch (error) {
    if (error instanceof Error && error.message.match(/no such file or directory/i)) {
      return false
    } else {
      throw error
    }
  }
}

export function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase()
}

export function isChild(filePath: string, parentPath: string): boolean {
  return path.resolve(parentPath, filePath).startsWith(parentPath + path.sep)
}

export function isURL(filePath: string): boolean {
  return /^[a-z]+:[/][/]/.test(filePath)
}

export async function readFile(fullPath: string): Promise<string> {
  return fs.readFile(fullPath, "utf8")
}

export async function readFileIfPresent(fullPath: string): Promise<string | undefined> {
  try {
    return await readFile(fullPath)
  } catch (error) {
    if (error instanceof Error && error.message.match(/no such file or directory/i)) {
      return undefined
    } else {
      throw error
    }
  }
}

export function removeExtension(filePath: string): string {
  const extension = getExtension(filePath)
  return extension ? filePath.slice(0, -extension.length) : filePath
}

export async function removeIfEmpty(fullPath: string): Promise<boolean> {
  try {
    await fs.rmdir(fullPath)
    return true
  } catch (error) {
    if (error instanceof Error && error.message.match(/no such file or directory/i)) {
      return true
    } else if (error instanceof Error && error.message.match(/not empty/i)) {
      return false
    } else {
      throw error
    }
  }
}

export async function removeIfPresent(fullPath: string): Promise<boolean> {
  try {
    await fs.rm(fullPath, { recursive: true })
    return true
  } catch (error) {
    if (error instanceof Error && error.message.match(/no such file or directory/i)) {
      return false
    } else {
      throw error
    }
  }
}

export function toPosix(filePath: string): string {
  return filePath.replaceAll(path.sep, "/")
}

export async function writeFile(fullPath: string, data: string): Promise<void> {
  await fs.writeFile(fullPath, data, "utf8")
}
