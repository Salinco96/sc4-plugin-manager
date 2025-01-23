import type { AssetID, Assets } from "@common/assets"
import type { AuthorID } from "@common/authors"
import { isNew } from "@common/packages"
import type { ToolID, ToolInfo } from "@common/tools"
import { type MaybeArray, parseStringArray } from "@common/utils/types"
import { isString, toLowerCase } from "@salinco/nice-utils"
import { loadCredits } from "./packages"

export interface ToolData {
  /**
   * Asset ID
   */
  asset?: AssetID

  /**
   * List of authors (array or comma-separated string, case-insensitive)
   *
   * - Tool will appear in the tool listing of all tagged authors
   * - Order matters (tags will be in the same order)
   * - Note that this is independent from {@link credits} and {@link thanks}
   */
  authors?: MaybeArray<string>

  /**
   * Credits
   */
  credits?: Array<AuthorID | string | { [authorId in AuthorID]: string }>

  /**
   * Full description
   */
  description?: string

  /**
   * Whether this tool should be hidden in Manager (e.g. work in progress)
   */
  disabled?: boolean

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
   * Content to copy to SimCity 4 installation folder
   */
  install?: string

  /**
   * Date or ISO string at which this variant was last modified/uploaded, as specified on its download page
   */
  lastModified?: Date | string

  /**
   * Relative path to documentation
   */
  readme?: MaybeArray<string>

  /**
   * Date or ISO string at which this tool was first added to the Manager database (used to mark "new" tools)
   */
  release?: Date | string

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
   * Credits
   */
  thanks?: Array<AuthorID | string | { [authorId in AuthorID]: string }>

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
  warnings?: Array<{ message: string; title?: string } | string>
}

export function loadToolInfo(toolId: ToolID, toolData: ToolData, assets: Assets): ToolInfo {
  const assetInfo = toolData.asset ? assets[toolData.asset] : undefined

  const toolInfo: ToolInfo = {
    asset: toolData.asset,
    authors: toolData.authors
      ? (parseStringArray(toolData.authors).map(toLowerCase) as AuthorID[])
      : undefined,
    credits: toolData.credits ? loadCredits(toolData.credits) : undefined,
    description: toolData.description,
    disabled: toolData.disabled,
    exe: toolData.exe,
    id: toolId,
    install: toolData.install,
    installed: assetInfo?.downloaded[assetInfo.version],
    images: toolData.images,
    lastModified: toolData.lastModified ? new Date(toolData.lastModified) : undefined,
    name: toolData.name,
    readme: isString(toolData.readme) ? [toolData.readme] : toolData.readme,
    release: toolData.release ? new Date(toolData.release) : undefined,
    repository: toolData.repository,
    summary: toolData.summary,
    support: toolData.support,
    thanks: toolData.thanks ? loadCredits(toolData.thanks) : undefined,
    thumbnail: toolData.thumbnail,
    url: toolData.url,
    version: toolData.version ?? "0.0.0",
    warnings: toolData.warnings?.map(warning =>
      isString(warning) ? { message: warning } : warning,
    ),
  }

  toolInfo.new = isNew(toolInfo)

  return toolInfo
}
