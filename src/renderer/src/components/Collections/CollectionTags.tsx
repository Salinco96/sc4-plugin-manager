import type { AuthorID } from "@common/authors"
import type { CategoryID } from "@common/categories"
import type { CollectionID } from "@common/collections"
import { getPackageStatus, isEnabled, isIncompatible } from "@common/packages"
import { VariantState } from "@common/types"
import { Tags } from "@components/Tags/Tags"
import { type TagInfo, TagType, createTag } from "@components/Tags/utils"
import { containsAll, mapDefined } from "@salinco/nice-utils"
import { getCurrentVariant, useCollectionInfo } from "@utils/packages"
import { getPackageInfo, useCurrentProfile, useStore } from "@utils/store"
import { useMemo } from "react"

export function CollectionTags({
  collectionId,
}: {
  collectionId: CollectionID
}): JSX.Element | null {
  const collection = useCollectionInfo(collectionId)
  const profileInfo = useCurrentProfile()

  const packages = useStore.shallow(store => {
    return mapDefined(collection.packages, packageId => getPackageInfo(store, packageId))
  })

  const variants = useStore.shallow(store => {
    return mapDefined(collection.packages, packageId => getCurrentVariant(store, packageId))
  })

  const tags = useMemo(() => {
    const compatiblePackages = packages.filter(packageInfo => {
      const packageStatus = getPackageStatus(packageInfo, profileInfo)
      const variantInfo = packageStatus && packageInfo.variants[packageStatus?.variantId]
      return !!variantInfo && !isIncompatible(variantInfo, packageStatus)
    })

    const enabledPackages = packages.filter(packageInfo => {
      const packageStatus = getPackageStatus(packageInfo, profileInfo)
      return isEnabled(packageStatus)
    })

    const authors = new Set<AuthorID>()
    const categories = new Set<CategoryID>()

    for (const variantInfo of variants) {
      for (const authorId of variantInfo.authors) {
        authors.add(authorId)
      }

      for (const categoryId of variantInfo.categories) {
        categories.add(categoryId)
      }
    }

    const tags: TagInfo[] = []

    for (const authorId of authors) {
      tags.push(createTag(TagType.AUTHOR, authorId))
    }

    for (const categoryId of categories) {
      tags.push(createTag(TagType.CATEGORY, categoryId))
    }

    if (enabledPackages.length && containsAll(enabledPackages, compatiblePackages)) {
      tags.push(createTag(TagType.STATE, VariantState.ENABLED))
    }

    if (collection.new) {
      tags.push(createTag(TagType.STATE, VariantState.NEW))
    }

    return tags
  }, [collection, packages, profileInfo, variants])

  return <Tags tags={tags} />
}
