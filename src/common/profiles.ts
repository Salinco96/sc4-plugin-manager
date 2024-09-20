import { Options } from "./options"
import { PackageID } from "./packages"
import { ConfigFormat, ExternalFeatures, ID, PackageConfig, PackageConfigs } from "./types"
import { normalizeString } from "./utils/types"

/** Profile ID */
export type ProfileID = ID<ProfileInfo>

/** Raw profile data */
export interface ProfileData {
  /** Features added outside of the Manager */
  features?: ExternalFeatures
  /** Profile name */
  name?: string
  /** Global option values */
  options?: Options
  /** Package configs */
  packages?: {
    [packageId in PackageID]?: PackageConfig | boolean | string
  }
}

/** Loaded profile data */
export interface ProfileInfo extends ProfileData {
  /** Template description */
  description?: string
  features: ExternalFeatures
  /** Current config format */
  format?: ConfigFormat
  /** Profile ID */
  id: ProfileID
  name: string
  options: Options
  packages: PackageConfigs
  /** Whether this profile is a template (defaults to false) */
  template?: boolean
}

/** Loaded profiles */
export type Profiles = {
  [profileId in ProfileID]?: ProfileInfo
}

/** Updates to a profile */
export interface ProfileUpdate {
  features?: ExternalFeatures
  name?: string
  options?: Options
  packages?: PackageConfigs
}

export function createUniqueProfileId(name: string, existingIds: ProfileID[]): ProfileID {
  const baseId = normalizeString(name.trim())
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .join("-") as ProfileID

  if (baseId) {
    if (!existingIds.includes(baseId)) {
      return baseId
    }

    let index = 2
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const id = `${baseId}-${index}` as ProfileID
      if (!existingIds.includes(id)) {
        return id
      }

      index++
    }
  }

  let index = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const id = `${index}` as ProfileID
    if (!existingIds.includes(id)) {
      return id
    }

    index++
  }
}
