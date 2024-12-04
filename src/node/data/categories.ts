import type { Categories, CategoryID, CategoryInfo } from "@common/categories"
import { type MaybeArray, parseStringArray } from "@common/utils/types"

export function loadCategories(data: MaybeArray<string>, categories: Categories): CategoryID[] {
  const subcategories = parseStringArray(data) as CategoryID[]

  let subcategory: CategoryID | undefined
  for (subcategory of subcategories) {
    while (subcategory) {
      const info: CategoryInfo | undefined = categories[subcategory]

      if (!subcategories.includes(subcategory)) {
        subcategories.unshift(subcategory)
      }

      subcategory = info?.parent
    }
  }

  return subcategories
}
