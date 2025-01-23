import type { PackageID } from "@common/packages"
import { VariantState, getState } from "@common/types"
import { store } from "@stores/main"
import { Page, useLocation } from "@utils/navigation"

import { PackageTag } from "./PackageTag"
import { Tags } from "./Tags"
import { TagType, createTag } from "./utils"

export function PackageTags({
  packageId,
}: {
  packageId: PackageID
}): JSX.Element | null {
  const location = useLocation()
  const profileInfo = store.useCurrentProfile()
  const packageInfo = store.usePackageInfo(packageId)
  const variantInfo = store.useCurrentVariant(packageId)

  const isSelectable = location.page === Page.Packages

  const tags = [
    ...variantInfo.authors.map(authorId => createTag(TagType.AUTHOR, authorId)),
    ...variantInfo.categories.map(category => createTag(TagType.CATEGORY, category)),
    ...[VariantState.DEPENDENCY, VariantState.DISABLED, VariantState.ENABLED, VariantState.ERROR]
      .filter(state => getState(state, packageInfo, variantInfo, profileInfo))
      .map(state => createTag(TagType.STATE, state)),
  ]

  return <Tags component={isSelectable ? PackageTag : undefined} tags={tags} />
}
