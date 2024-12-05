import type { ID } from "@salinco/nice-utils"

export type FloraID = ID<string, FloraInfo>

export interface FloraInfo {
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
   * Flora instance ID
   */
  id: FloraID

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
