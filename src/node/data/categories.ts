import type { Categories, CategoryID } from "@common/categories"
import { type MaybeArray, parseStringArray, toLowerCase } from "@common/utils/types"
import { mapDefined, toArray, unique } from "@salinco/nice-utils"

export function loadCategories(data: MaybeArray<string>, categories: Categories): CategoryID[] {
  return unique(
    parseStringArray(data)
      .map(toLowerCase)
      .flatMap(category => {
        const subcategories = new Set<CategoryID>()

        let subcategory = category as CategoryID | undefined
        while (subcategory && !subcategories.has(subcategory)) {
          subcategories.add(subcategory)
          subcategory = categories[subcategory]?.parent
        }

        return toArray(subcategories)
      }),
  )
}

export function getPriority(variantCategories: CategoryID[], categories: Categories): number {
  return Math.max(0, ...mapDefined(variantCategories, category => categories[category]?.priority))
}
