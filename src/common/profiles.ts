import { Options } from "./options"
import { PackageID } from "./packages"
import { ConfigFormat, ExternalFeatures, ID, PackageConfig, PackageConfigs } from "./types"
import { normalizeString } from "./utils/types"
import { VariantID } from "./variants"

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
  packages?: {
    [packageId in PackageID]?: {
      enabled?: boolean
      /** null to reset options */
      options?: Options | null
      variant?: VariantID
      version?: string
    }
  }
}

export function createUniqueId<T extends ID<object>>(name: string, existingIds: T[]): T {
  const baseId = normalizeString(name.trim())
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .join("-") as T

  if (baseId) {
    if (!existingIds.includes(baseId)) {
      return baseId
    }

    for (let index = 2; index < 100; index++) {
      const id = `${baseId}-${index}` as T
      if (!existingIds.includes(id)) {
        return id
      }
    }
  }

  for (let index = 1; index < 100; index++) {
    const id = `${index}` as T
    if (!existingIds.includes(id)) {
      return id
    }
  }

  throw Error(`Failed to generate unique ID from '${name}'`)
}
