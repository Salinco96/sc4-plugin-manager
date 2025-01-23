import type { PackageID } from "@common/packages"
import { VariantState, getState } from "@common/types"
import type { VariantID } from "@common/variants"
import { store } from "@stores/main"

import { Tags } from "./Tags"
import { TagType, createTag } from "./utils"

export function VariantTags({
  packageId,
  variantId,
}: {
  packageId: PackageID
  variantId: VariantID
}): JSX.Element | null {
  const profileInfo = store.useCurrentProfile()
  const packageInfo = store.usePackageInfo(packageId)
  const variantInfo = store.useVariantInfo(packageId, variantId)

  const tags = [
    ...variantInfo.authors.map(authorId => createTag(TagType.AUTHOR, authorId)),
    ...[VariantState.DEFAULT, VariantState.CURRENT]
      .filter(state => getState(state, packageInfo, variantInfo, profileInfo))
      .map(state => createTag(TagType.STATE, state)),
  ]

  return <Tags tags={tags} />
}
