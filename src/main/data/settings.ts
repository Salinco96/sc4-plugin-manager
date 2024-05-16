import fs from "fs/promises"
import path from "path"

import { parse } from "yaml"

import { Settings } from "@common/types"

import { getRootPath } from "../utils/paths"

export async function loadSettings(): Promise<Settings> {
  const entries = await fs.readdir(getRootPath(), { withFileTypes: true })

  const configEntry = entries.find(
    entry => entry.isFile() && entry.name.match(/^settings\.(json|ya?ml)$/),
  )

  let settings: Settings | undefined

  if (configEntry) {
    const configPath = path.join(getRootPath(), configEntry.name)
    const configData = await fs.readFile(configPath, "utf8")
    settings = configPath.endsWith("json") ? JSON.parse(configData) : parse(configData)
  }

  return settings ?? {}
}

export async function writeSettings(settings: Settings): Promise<void> {
  const configPath = path.join(getRootPath(), "settings.json")
  await fs.writeFile(configPath, JSON.stringify(settings, undefined, 2))
}
