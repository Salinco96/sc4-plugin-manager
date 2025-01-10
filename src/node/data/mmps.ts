import type { GroupID } from "@common/dbpf"
import type { FloraID, FloraInfo } from "@common/mmps"
import { loadModelId, writeModelId } from "./packages"

export interface FloraData {
  /**
   * Description
   */
  description?: string

  /**
   * URL or relative path within ~docs
   */
  images?: string[]

  /**
   * Pretty name
   */
  label?: string

  /**
   * Model ID
   */
  model?: GroupID | `${GroupID}-${string}` | null

  /**
   * Internal exemplar name
   */
  name?: string

  /**
   * Additional stages
   */
  stages?: {
    /**
     * Flora instance ID
     */
    id: FloraID

    /**
     * Model ID
     */
    model?: GroupID | `${GroupID}-${string}` | null

    /**
     * Internal exemplar name
     */
    name?: string
  }[]
}

export function loadFloraInfo(
  file: string,
  group: GroupID,
  id: FloraID,
  data: FloraData,
): FloraInfo {
  return {
    description: data.description,
    file,
    group,
    id,
    images: data.images,
    label: data.label,
    model: data.model && loadModelId(data.model),
    name: data.name,
    stages: data.stages?.map(stage => ({
      id: stage.id,
      model: stage.model && loadModelId(stage.model),
      name: stage.name,
    })),
  }
}

export function writeFloraInfo(mmp: FloraInfo): FloraData {
  return {
    description: mmp.description,
    images: mmp.images,
    label: mmp.label,
    model: mmp.model && writeModelId(mmp.model),
    name: mmp.name,
    stages: mmp.stages?.map(stage => ({
      id: stage.id,
      model: stage.model && writeModelId(stage.model),
      name: stage.name,
    })),
  }
}
