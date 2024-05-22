import fs from "fs/promises"

import { parse as yamlParse, stringify as yamlStringify } from "yaml"

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
  await fs.mkdir(fullPath, { recursive: true })
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

export function serializeConfig<T>(data: T, format: "json" | "yaml"): string {
  return format === "json" ? JSON.stringify(data, undefined, 2) : yamlStringify(data)
}

export function deserializeConfig<T>(data: string, format: "json" | "yaml"): T {
  return format === "json" ? JSON.parse(data) : yamlParse(data)
}
