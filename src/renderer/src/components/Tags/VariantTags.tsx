import type { PackageID } from "@common/packages"
import { VariantState, getState } from "@common/types"
import type { VariantID } from "@common/variants"
import { usePackageInfo, useVariantInfo } from "@utils/packages"
import { useCurrentProfile } from "@utils/store"
import { Tags } from "./Tags"
import { TagType, createTag } from "./utils"

export function VariantTags({
  packageId,
  variantId,
}: {
  packageId: PackageID
  variantId: VariantID
}): JSX.Element | null {
  const profileInfo = useCurrentProfile()
  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useVariantInfo(packageId, variantId)

  const tags = [
    ...variantInfo.authors.map(authorId => createTag(TagType.AUTHOR, authorId)),
    ...[VariantState.DEFAULT, VariantState.SELECTED]
      .filter(state => getState(state, packageInfo, variantInfo, profileInfo))
      .map(state => createTag(TagType.STATE, state)),
  ]

  return <Tags tags={tags} />
}
