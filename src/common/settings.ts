import type { ProfileID } from "./profiles"
import type { CityID, RegionID } from "./regions"
import type { ConfigFormat } from "./types"

/** Raw global settings */
export interface SettingsData {
  /** Current profile ID */
  currentProfile?: ProfileID
  /** Game installation data */
  install?: {
    /** Whether the 4GB patch is applied */
    patched?: boolean
    /** Absolute path to game installation folder */
    path: string
    /** Executable version */
    version?: string
    /** Whether DgVoodoo is installed */
    dgvoodoo?: boolean
  }
  /** Regions */
  regions?: {
    [regionId in RegionID]?: {
      cities?: {
        [cityId in CityID]?: {
          profile?: ProfileID
        }
      }
      profile?: ProfileID
    }
  }
  startup?: {
    reloadMaxis?: boolean
    reloadPlugins?: boolean
    removeConflictingPlugins?: boolean
    removeUnsupportedPlugins?: boolean
  }
}

/** Loaded global settings */
export interface Settings {
  /** Current profile ID */
  currentProfile?: ProfileID
  db: { path: string; url?: undefined } | { path?: undefined; url: string }
  env: {
    /** Are we in development mode? */
    dev: boolean
  }
  /** Current config format */
  format?: ConfigFormat
  /** Game installation data */
  install?: {
    /** Whether the 4GB patch is applied */
    patched?: boolean
    /** Absolute path to game installation folder */
    path: string
    /** Executable version */
    version?: string
    /** Whether DgVoodoo is installed */
    voodoo?: boolean
  }
  /** Regions */
  regions?: {
    [regionId in RegionID]?: {
      cities?: {
        [cityId in CityID]?: {
          profile?: ProfileID
        }
      }
      profile?: ProfileID
    }
  }
  startup: {
    reloadMaxis: boolean
    reloadPlugins: boolean
    removeConflictingPlugins: boolean
    removeUnsupportedPlugins: boolean
  }
  /** Available manager update */
  update?: {
    /** URL to latest version download page (not the download URL itself) */
    url: string
    /** Latest available manager version */
    version: string
  }
  /** Current manager version */
  version: string
}
