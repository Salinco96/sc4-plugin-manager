import { t } from "./i18n"
import { ID, PackageState, VariantInfo } from "./types"
import { isString } from "./utils/types"

/** Category ID */
export type CategoryID = ID<CategoryInfo>

/** Category info */
export interface CategoryInfo {
  /** Parent category ID (if any) */
  parent?: CategoryID
  /** Priority (between 0 and 999) */
  priority?: number
}

/** Loaded categories */
export interface Categories {
  [categoryId: CategoryID]: CategoryInfo | undefined
}

export function getStateLabel(state: PackageState): string {
  return t(state, { ns: "PackageState" })
}

export function getCategories(variantInfo: VariantInfo): CategoryID[] {
  return variantInfo.categories
}

export function getCategoryLabel(categoryId: CategoryID): string {
  const label = t(categoryId, { defaultValue: "", ns: "PackageCategory" })
  if (isString(label)) {
    return label
  } else {
    console.error(`Missing label for category ${categoryId}`)
    return categoryId
  }
}

export function isCategory(variantInfo: VariantInfo, categoryId: CategoryID): boolean {
  return variantInfo.categories.includes(categoryId)
}
