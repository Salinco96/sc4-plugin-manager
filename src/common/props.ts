import type { GroupID, InstanceID } from "./dbpf"
import type { FamilyID } from "./families"
import type { ModelID } from "./variants"

export type PropID = InstanceID<PropInfo>

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
   * Prop group ID
   */
  group: GroupID

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
  model?: ModelID | null

  /**
   * Internal exemplar name
   */
  name?: string
}
