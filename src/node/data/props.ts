import type { FamilyID } from "@common/families"
import type { PropID, PropInfo } from "@common/props"
import { type MaybeArray, parseStringArray } from "@common/utils/types"

export interface PropData {
  /**
   * Prop family ID
   */
  family?: MaybeArray<string>

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

export function loadPropInfo(file: string, id: PropID, data: PropData): PropInfo {
  const { family, ...others } = data

  const families = family ? (parseStringArray(family) as FamilyID[]) : undefined

  return { ...others, families, file, id }
}

export function writePropInfo(prop: PropInfo): PropData {
  const { families, file, id, ...others } = prop

  return { ...others, family: families?.length ? families?.join(",") : undefined }
}
