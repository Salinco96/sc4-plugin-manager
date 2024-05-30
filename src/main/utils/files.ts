import fs from "fs/promises"

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

export async function writeFile(fullPath: string, data: string): Promise<void> {
  await fs.writeFile(fullPath, data, "utf8")
}

export async function createIfMissing(fullPath: string): Promise<void> {
  try {
    await fs.mkdir(fullPath, { recursive: true })
  } catch (error) {
    if (error instanceof Error && error.message.match(/already exists/i)) {
      return undefined
    } else {
      throw error
    }
  }
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
