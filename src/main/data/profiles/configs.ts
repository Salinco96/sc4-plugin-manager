import { ProfileData, ProfileInfo } from "@common/types"

import { ReadonlyDeep } from "../packages/resolve"

export function compactProfileConfig(profile: ProfileInfo): void {
  for (const packageId in profile.packages) {
    const config = profile.packages[packageId]
    if (config?.options && !Object.keys(config.options).length) {
      delete config.options
    }

    if (config?.enabled === false) {
      delete config.enabled
    }

    if (!config?.enabled && !config?.options && !config?.variant) {
      delete profile.packages[packageId]
    }
  }

  for (const groupId in profile.externals) {
    if (!profile.externals[groupId]) {
      delete profile.externals[groupId]
    }
  }
}

export function toProfileData(profile: ReadonlyDeep<ProfileInfo>): ProfileData {
  const data: ProfileData = {}

  if (profile.name !== profile.id) {
    data.name = profile.name
  }

  for (const packageId in profile.packages) {
    data.packages ??= {}
    data.packages[packageId] = profile.packages[packageId]
  }

  for (const groupId in profile.externals) {
    data.externals ??= {}
    if (profile.externals[groupId]) {
      data.externals[groupId] = true
    }
  }

  return data
}

export function fromProfileData(profileId: string, data: ReadonlyDeep<ProfileData>): ProfileInfo {
  return {
    externals: data.externals ?? {},
    id: profileId,
    name: data.name ?? profileId,
    packages: Object.fromEntries(
      Object.entries(data.packages ?? {}).map(([packageId, config]) => {
        if (typeof config === "boolean") {
          return [packageId, { enabled: config }]
        }

        if (typeof config === "string") {
          return [packageId, { enabled: true, variant: config }]
        }

        return [packageId, config]
      }),
    ),
  }
}
