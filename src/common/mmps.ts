import type { GroupID, InstanceID } from "./dbpf"
import type { ModelID } from "./variants"

export type FloraID = InstanceID<FloraInfo>

export interface FloraInfo extends FloraStageInfo {
  /**
   * Description
   */
  description?: string

  /**
   * Path to exemplar file (POSIX)
   *
   * For now we will assume that all stages/texts/icons are in the same file...
   */
  file: string

  /**
   * Flora group ID
   */
  group: GroupID

  /**
   * URL or relative path within ~docs
   */
  images?: string[]

  /**
   * Pretty name
   */
  label?: string

  /**
   * Additional stages
   */
  stages?: FloraStageInfo[]
}

export interface FloraStageInfo {
  /**
   * Flora instance ID
   */
  id: FloraID

  /**
   * Model ID
   */
  model?: ModelID | null

  /**
   * Internal exemplar name
   */
  name?: string
}
