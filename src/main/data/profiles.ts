import fs from "fs/promises"
import path from "path"

import { stringify } from "yaml"

import { ProfileInfo } from "@common/types"

import { getProfilesPath } from "../utils/paths"

import { loadYAMLRecursively } from "./utils"

export async function loadProfiles(): Promise<{ [id: string]: ProfileInfo }> {
  console.info("Loading profiles...")

  const configs = await loadYAMLRecursively<ProfileInfo, Omit<ProfileInfo, "id">>(
    getProfilesPath(),
    (data, entryPath) => ({
      ...data,
      id: path.basename(entryPath).replace(path.extname(entryPath), ""),
      packages: data.packages ?? {},
    }),
  )

  console.info(`Loaded ${configs.length} profiles`)

  const profiles: { [id: string]: ProfileInfo } = {}
  for (const config of configs) {
    profiles[config.id] = config
  }

  return profiles
}

export async function writeProfile(profile: ProfileInfo): Promise<void> {
  console.info("Saving profile...")

  const { id, ...data } = profile
  const profilePath = path.join(getProfilesPath(), `${id}.yml`)
  await fs.writeFile(profilePath, stringify(data))
}
