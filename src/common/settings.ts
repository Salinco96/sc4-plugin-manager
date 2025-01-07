import type { ProfileID } from "./profiles"
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
}

/** Loaded global settings */
export interface Settings {
  /** Current profile ID */
  currentProfile?: ProfileID
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
