import fs from "fs/promises"
import path from "path"

import { parseAllDocuments } from "yaml"

export async function loadRecursively<Data>(
  rootPath: string,
  pattern: RegExp,
  handler: (entryPath: string) => Promise<Data[]>,
  onError: (error: Error) => void = console.error,
): Promise<Data[]> {
  const result: Data[] = []

  async function recursive(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          await recursive(entryPath)
        } else if (entry.name.match(pattern)) {
          try {
            const items = await handler(entryPath)
            result.push(...items)
          } catch (error) {
            onError(error as Error)
          }
        }
      }
    } catch (error) {
      onError(error as Error)
    }
  }

  await recursive(rootPath)

  return result
}

export function loadYAMLRecursively<Data, RawData = Data>(
  rootPath: string,
  handler: (data: RawData, entryPath: string) => Data = data => data as unknown as Data,
  onError: (error: Error) => void = console.error,
): Promise<Data[]> {
  return loadRecursively(
    rootPath,
    /\.ya?ml$/,
    async (entryPath: string) => {
      const data = await fs.readFile(entryPath, "utf8")
      const docs = parseAllDocuments(data)
      return "empty" in docs ? [] : docs.map(doc => handler(doc.toJS(), entryPath))
    },
    onError,
  )
}
