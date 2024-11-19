import { ID } from "./types"
import { VariantInfo } from "./variants"

/** Category ID */
export type CategoryID = ID<CategoryInfo>

export const CategoryID = {
  AGRICULTURE: ID("agriculture"),
  COMMERCIAL: ID("commercial"),
  CIVICS: ID("civics"),
  DEPENDENCIES: ID("dependencies"),
  INDUSTRY: ID("industry"),
  LANDMARKS: ID("landmarks"),
  MODS: ID("mods"),
  PARKS: ID("parks"),
  PROPS: ID("props"),
  RESIDENTIAL: ID("residential"),
  TEXTURES: ID("textures"),
  TRANSPORT: ID("transport"),
  UTILITIES: ID("utilities"),
} as const satisfies {
  [category: string]: CategoryID
}

/** Category info */
export interface CategoryInfo {
  label: string
  /** Parent category ID (if any) */
  parent?: CategoryID
  /** Priority (between 0 and 999) */
  priority?: number
}

/** Loaded categories */
export type Categories = {
  [categoryId in CategoryID]?: CategoryInfo
}

export function getCategories(variantInfo: VariantInfo): CategoryID[] {
  return variantInfo.categories
}

export function getCategoryLabel(categoryId: CategoryID, categories: Categories): string {
  const info = categories[categoryId]
  if (info) {
    return info.label
  } else {
    console.error(`Unknown category '${categoryId}'`)
    return categoryId
  }
}

export function isCategory(variantInfo: VariantInfo, categoryId: CategoryID): boolean {
  return variantInfo.categories.includes(categoryId)
}
