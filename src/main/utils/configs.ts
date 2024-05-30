import path from "path"

import {
  parse as yamlParse,
  parseAllDocuments as yamlParseMany,
  stringify as yamlStringify,
} from "yaml"

import { ConfigFormat } from "@common/types"

import { createIfMissing, readFile, readFileIfPresent, removeIfPresent, writeFile } from "./files"

export function deserializeConfig<T>(data: string, format: ConfigFormat): T {
  return format === ConfigFormat.JSON ? JSON.parse(data) : yamlParse(data)
}

export async function loadConfig<T>(
  basePath: string,
  filename: string,
): Promise<{ data: T; format: ConfigFormat } | undefined> {
  for (const format of Object.values(ConfigFormat)) {
    const fullPath = path.join(basePath, filename + format)
    const raw = await readFileIfPresent(fullPath)
    if (raw) {
      const data = deserializeConfig<T>(raw, format)
      return { data, format }
    }
  }
}

export async function readConfig<T>(fullPath: string): Promise<T> {
  const raw = await readFile(fullPath)
  return deserializeConfig<T>(raw, path.extname(fullPath) as ConfigFormat)
}

export async function readConfigs<T>(fullPath: string): Promise<T[]> {
  const raw = await readFile(fullPath)
  const docs = yamlParseMany(raw)
  if ("empty" in docs) {
    return []
  }

  return docs.map(doc => doc.toJS() as T)
}

export function serializeConfig<T>(data: T, format: ConfigFormat): string {
  return format === ConfigFormat.JSON ? JSON.stringify(data, undefined, 2) : yamlStringify(data)
}

export async function writeConfig<T>(
  basePath: string,
  filename: string,
  data: T,
  newFormat: ConfigFormat,
  oldFormat?: ConfigFormat,
): Promise<void> {
  const newPath = path.join(basePath, filename + newFormat)
  const raw = serializeConfig(data, newFormat)
  await createIfMissing(path.dirname(newPath))
  await writeFile(newPath, raw)
  if (oldFormat && oldFormat !== newFormat) {
    const oldPath = path.join(basePath, filename + oldFormat)
    await removeIfPresent(oldPath)
  }
}
