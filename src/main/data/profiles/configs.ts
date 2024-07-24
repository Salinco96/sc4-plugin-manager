import { ProfileData, ProfileInfo } from "@common/types"
import { keys } from "@common/utils/objects"

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

  for (const feature of keys(profile.features)) {
    if (profile.features[feature] === false) {
      delete profile.features[feature]
    }
  }
}

export function toProfileData(profile: Readonly<ProfileInfo>): ProfileData {
  const data: ProfileData = {}

  if (profile.name !== profile.id) {
    data.name = profile.name
  }

  for (const feature of keys(profile.features)) {
    data.features ??= {}
    data.features[feature] = profile.features[feature]
  }

  for (const optionId in profile.options) {
    data.options ??= {}
    data.options[optionId] = profile.options[optionId]
  }

  for (const packageId in profile.packages) {
    data.packages ??= {}
    data.packages[packageId] = profile.packages[packageId]
  }

  return data
}

export function fromProfileData(profileId: string, data: Readonly<ProfileData>): ProfileInfo {
  return {
    features: data.features ?? {},
    id: profileId,
    name: data.name ?? profileId,
    options: data.options ?? {},
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
