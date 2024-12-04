import type { FamilyID } from "@common/families"
import type { PropID, PropInfo } from "@common/props"

export interface PropData {
  /**
   * Prop family ID
   */
  family?: FamilyID

  /**
   * URL or relative path within ~docs
   */
  images?: string[]

  /**
   * Model ID
   */
  model?: string

  /**
   * Internal exemplar name
   */
  name?: string
}

export function loadPropInfo(file: string, id: PropID, data: PropData): PropInfo {
  const { model, ...others } = data
  return { ...others, file, id }
}

export function writePropInfo(prop: PropInfo): PropData {
  const { file, id, ...others } = prop
  return others
}
