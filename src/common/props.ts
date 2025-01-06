import type { ID } from "@salinco/nice-utils"
import type { FamilyID } from "./families"

export type PropID = ID<string, PropInfo>

export interface PropInfo {
  /**
   * Prop family IDs
   */
  families?: FamilyID[]

  /**
   * Path to exemplar file (POSIX)
   */
  file: string

  /**
   * Prop instance ID
   */
  id: PropID

  /**
   * URL or relative path within ~docs
   */
  images?: string[]

  /**
   * Model ID
   */
  model?: string | null

  /**
   * Internal exemplar name
   */
  name?: string
}
