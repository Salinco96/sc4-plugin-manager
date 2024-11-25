import fs from "node:fs/promises"
import path from "node:path"

import { isEmpty, isEnum, isObject, keys, mapValues, size, values } from "@salinco/nice-utils"

import type { ProfileData, ProfileID, ProfileInfo, Profiles } from "@common/profiles"
import { ConfigFormat } from "@common/types"
import type { VariantID } from "@common/variants"
import { readConfig } from "@node/configs"
import { createIfMissing } from "@node/files"
import type { TaskContext } from "@utils/tasks"

export async function loadProfiles(context: TaskContext, profilesPath: string): Promise<Profiles> {
  const profiles: Profiles = {}

  await createIfMissing(profilesPath)

  const entries = await fs.readdir(profilesPath, { withFileTypes: true })
  for (const entry of entries) {
    const format = path.extname(entry.name)
    if (entry.isFile() && isEnum(format, ConfigFormat)) {
      const profileId = path.basename(entry.name, format) as ProfileID
      const profilePath = path.join(profilesPath, entry.name)
      if (profiles[profileId]) {
        context.warn(`Duplicate profile configuration '${entry.name}'`)
        continue
      }

      try {
        const data = await readConfig<ProfileData>(profilePath)
        const profile = fromProfileData(profileId, data)
        profile.format = format
        profiles[profileId] = profile
      } catch (error) {
        context.warn(`Invalid profile configuration '${entry.name}'`, error)
      }
    }
  }

  context.debug(`Loaded ${size(profiles)} profiles`)

  return profiles
}

export function compactProfileConfig(profile: ProfileInfo): void {
  for (const packageId of keys(profile.packages)) {
    const config = profile.packages[packageId]
    if (config?.options && isEmpty(config.options)) {
      config.options = undefined
    }

    if (config?.enabled === false) {
      config.enabled = undefined
    }

    if (!config?.enabled && !config?.options && !config?.variant) {
      delete profile.packages[packageId]
    }
  }

  for (const feature of keys(profile.features)) {
    if (profile.features[feature] === false) {
      delete profile.features[feature]
    }
  }
}

export function fromProfileData(profileId: ProfileID, data: Readonly<ProfileData>): ProfileInfo {
  return {
    features: data.features ?? {},
    id: profileId,
    name: data.name ?? profileId,
    options: data.options ?? {},
    packages: mapValues(data.packages ?? {}, config => {
      if (typeof config === "boolean") {
        return { enabled: config }
      }

      if (typeof config === "string") {
        return { enabled: true, variant: config as VariantID }
      }

      return config
    }),
  }
}

export function toProfileData(profile: Readonly<ProfileInfo>): ProfileData {
  const data: ProfileData = {}

  if (profile.name !== profile.id) {
    data.name = profile.name
  }

  if (!isEmpty(profile.features)) {
    data.features = profile.features
  }

  if (!isEmpty(profile.options)) {
    data.options = profile.options
  }

  if (!isEmpty(profile.packages)) {
    data.packages = profile.packages
    for (const config of values(data.packages)) {
      if (isObject(config)) {
        config.version = undefined
      }
    }
  }

  return data
}
