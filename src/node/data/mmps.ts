import type { FloraID, FloraInfo } from "@common/mmps"

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
  model?: string

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
    model?: string

    /**
     * Internal exemplar name
     */
    name?: string
  }[]
}

export function loadFloraInfo(file: string, id: FloraID, data: FloraData): FloraInfo {
  const { model, ...others } = data
  return { ...others, file, id }
}

export function writeFloraInfo(prop: FloraInfo): FloraData {
  const { file, id, ...others } = prop
  return others
}
