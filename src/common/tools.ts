import type { ID } from "@salinco/nice-utils"

import type { AssetID } from "./assets"
import type { AuthorID } from "./authors"

/** Tool ID */
export type ToolID = ID<string, ToolInfo>

export const ToolID = {
  DgVoodoo: "dgvoodoo" as ToolID,
  SC4PIM: "sc4pim" as ToolID,
} satisfies Record<string, ToolID>

/** Tool info */
export interface ToolInfo {
  action?: "installing" | "removing" | "running"

  /**
   * Asset ID
   */
  asset?: AssetID

  /**
   * List of authors
   *
   * - Tool will appear in the tool listing of all tagged authors
   * - Order matters (tags will be in the same order)
   * - Note that this is independent from {@link credits} and {@link thanks}
   */
  authors?: AuthorID[]

  /**
   * Credits
   */
  credits?: { id?: AuthorID; text?: string }[]

  /**
   * Full description
   */
  description?: string

  /**
   * Whether this tool should be hidden in Manager (e.g. work in progress)
   */
  disabled?: boolean

  /**
   * Tool ID
   */
  id: ToolID

  /**
   * Whether this tool is currently installed
   */
  installed?: boolean

  /**
   * List of image URLs
   */
  images?: string[]

  /**
   * Tool name
   */
  name: string

  /**
   * Relative path to executable
   */
  exe: string

  /**
   * Date at which this variant was last modified/uploaded, as specified on its download page
   */
  lastModified?: Date

  /**
   * Whether this tool was recently added to the Manager database
   */
  new?: boolean

  /**
   * Relative path to documentation
   */
  readme?: string[]

  /**
   * Date at which this tool was first added to the Manager database (used to mark "new" tools)
   */
  release?: Date

  /**
   * URL to GitHub repository
   */
  repository?: string

  /**
   * Shorter description, containing no line breaks or formatting, displayed instead of {@link description} when space is limited (e.g. package listing)
   */
  summary?: string

  /**
   * URL to support thread
   */
  support?: string

  /**
   * Thanks
   */
  thanks?: { id?: AuthorID; text?: string }[]

  /**
   * URL to thumbnail
   */
  thumbnail?: string

  /**
   * URL to main download page
   */
  url?: string

  /**
   * Valid semver version (x.x.x)
   */
  version?: string

  /**
   * Warnings
   */
  warnings?: { message: string; title?: string }[]
}

export type Tools = {
  [toolId in ToolID]?: ToolInfo
}
