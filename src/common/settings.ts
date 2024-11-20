import type { ProfileID } from "./profiles"
import type { ConfigFormat } from "./types"

/** Global settings */
export interface Settings {
  /** Current profile ID */
  currentProfile?: ProfileID
  /** Current config format */
  format?: ConfigFormat
  install?: {
    /** Whether the 4GB patch is applied */
    patched?: boolean
    /** Absolute path to game installation folder */
    path: string
    /** Executable version */
    version?: string
  }
}
