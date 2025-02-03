import { sort } from "@salinco/nice-utils"

import type { GroupID } from "@common/dbpf"
import type { FamilyID } from "@common/families"
import type { PropID, PropInfo } from "@common/props"
import { type MaybeArray, parseStringArray } from "@common/utils/types"

import { loadModelId, writeModelId } from "./plugins"

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
  model?: GroupID | `${GroupID}-${string}` | null

  /**
   * Internal exemplar name
   */
  name?: string
}

export function loadPropInfo(file: string, group: GroupID, id: PropID, data: PropData): PropInfo {
  return {
    families: data.family ? (parseStringArray(data.family) as FamilyID[]) : undefined,
    file,
    group,
    id,
    images: data.images,
    model: data.model && loadModelId(data.model),
    name: data.name,
  }
}

export function writePropInfo(prop: PropInfo): PropData {
  return {
    family: prop.families?.length ? sort(prop.families).join(",") : undefined,
    images: prop.images,
    model: prop.model && writeModelId(prop.model),
    name: prop.name,
  }
}
