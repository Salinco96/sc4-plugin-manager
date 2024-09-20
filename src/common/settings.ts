import { ProfileID } from "./profiles"
import { ConfigFormat } from "./types"

/** Global settings */
export interface Settings {
  /** Current profile ID */
  currentProfile?: ProfileID
  /** Current config format */
  format?: ConfigFormat
  /**  */
  install?: {
    /** Whether the 4GB patch is applied */
    patched?: boolean
    /**  */
    path?: string
    /** Executable version */
    version?: string
  }
  /** Whether to prefer YAML configs over JSON */
  useYaml?: boolean
}
