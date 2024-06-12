import { useMemo, useRef } from "react"

import { PackageCategory, PackageState, getCategory, getState } from "@common/types"
import { PACKAGE_BANNER_HEIGHT, PACKAGE_BANNER_SPACING } from "@components/PackageBanners"
import { Page, useHistory } from "@utils/navigation"
import { getCurrentVariant, getPackageStatus } from "@utils/packages"
import { useCurrentProfile, useStore } from "@utils/store"

import { EmptyPackageList } from "./EmptyPackageList"
import { PackageListItem } from "./PackageListItem"
import { TagType, parseTag } from "./utils"
import { VirtualList } from "./VirtualList"

const PACKAGE_LIST_ITEM_BASE_SIZE = 180
const PACKAGE_LIST_ITEM_BANNER_SIZE = PACKAGE_BANNER_HEIGHT + PACKAGE_BANNER_SPACING
const PACKAGE_LIST_ITEM_DESCRIPTION_SIZE = 56
const PACKAGE_LIST_ITEM_SPACING = 16
const PACKAGE_LIST_PADDING = 16

export function PackageList(): JSX.Element {
  const currentProfile = useCurrentProfile()
  const allPackages = useStore(store => store.packages)
  const packageFilters = useStore(store => store.packageFilters)
  const history = useHistory()

  // TODO: Messy filtering - should be moved to Zustand
  const filteredPackages = useMemo(() => {
    let pattern: RegExp | undefined

    if (packageFilters.search.trim()) {
      pattern = RegExp("\\b" + packageFilters.search.trim().replaceAll(/\W/g, "\\$&"), "i")
    }

    const authors: string[] = []
    const categories: PackageCategory[] = []
    for (const tag of packageFilters.tags) {
      const { type, value } = parseTag(tag)
      switch (type) {
        case TagType.AUTHOR:
          authors.push(value)
          break
        case TagType.CATEGORY:
          categories.push(value as PackageCategory)
      }
    }

    const packages = Object.values(allPackages ?? {}).filter(info => {
      const variantInfo = getCurrentVariant(info, currentProfile)

      if (authors.length) {
        if (!variantInfo.authors.some(author => authors.includes(author))) {
          return false
        }
      }

      if (categories.length) {
        if (!categories.includes(getCategory(variantInfo))) {
          return false
        }
      }

      if (packageFilters.state) {
        if (!getState(packageFilters.state, info, variantInfo.id, currentProfile)) {
          return false
        }
      }

      if (!packageFilters.onlyErrors && !packageFilters.onlyUpdates) {
        if (!packageFilters.dependencies) {
          if (getCategory(variantInfo) === PackageCategory.DEPENDENCIES) {
            return false
          }
        }

        if (!packageFilters.experimental) {
          if (getState(PackageState.EXPERIMENTAL, info, variantInfo.id, currentProfile)) {
            return false
          }
        }

        if (!packageFilters.incompatible) {
          if (getState(PackageState.INCOMPATIBLE, info, variantInfo.id, currentProfile)) {
            return false
          }
        }
      }

      if (packageFilters.onlyErrors) {
        if (!getState(PackageState.ERROR, info, variantInfo.id, currentProfile)) {
          return false
        }
      }

      if (packageFilters.onlyUpdates) {
        if (!getState(PackageState.OUTDATED, info, variantInfo.id, currentProfile)) {
          return false
        }
      }

      if (pattern && !pattern?.test(info.id + "|" + info.name)) {
        return false
      }

      return true
    })

    packages.sort((a, b) => a.id.localeCompare(b.id))

    return packages.map(info => info.id)
  }, [allPackages, currentProfile, packageFilters])

  const scrolled = useRef(false)

  if (filteredPackages.length === 0) {
    return <EmptyPackageList />
  }

  return (
    <VirtualList<string>
      baseSize={PACKAGE_LIST_ITEM_BASE_SIZE}
      items={filteredPackages}
      itemComponent={PackageListItem}
      itemSize={(packageId, size) => {
        const packageInfo = allPackages?.[packageId]

        if (packageInfo) {
          const packageStatus = getPackageStatus(packageInfo, currentProfile)
          const variantInfo = getCurrentVariant(packageInfo, currentProfile)
          const variantIssues = packageStatus.issues[packageStatus.variantId]

          if (variantInfo.deprecated) {
            size += PACKAGE_LIST_ITEM_BANNER_SIZE
          }

          if (variantInfo.experimental) {
            size += PACKAGE_LIST_ITEM_BANNER_SIZE
          }

          if (packageStatus.enabled && !variantInfo.installed) {
            size += PACKAGE_LIST_ITEM_BANNER_SIZE
          }

          if (variantIssues?.length) {
            size += PACKAGE_LIST_ITEM_BANNER_SIZE * variantIssues.length
          }

          if (variantInfo.update) {
            size += PACKAGE_LIST_ITEM_BANNER_SIZE
          }

          // We expect most packages to have a description so that is pre-included in base size
          if (!variantInfo.description) {
            size -= PACKAGE_LIST_ITEM_DESCRIPTION_SIZE
          }
        }

        return size
      }}
      paddingBottom={PACKAGE_LIST_PADDING}
      paddingLeft={PACKAGE_LIST_PADDING}
      paddingRight={PACKAGE_LIST_PADDING}
      paddingTop={PACKAGE_LIST_PADDING}
      ref={list => {
        list?.resetAfterIndex(0)

        // Scroll to package upon coming back from package view
        if (list && history.previous?.page === Page.PackageView && !scrolled.current) {
          const fromPackageId = history.previous.data.packageId
          const index = filteredPackages.indexOf(fromPackageId)
          if (index >= 0) {
            list.scrollToItem(index, "start")
          }

          scrolled.current = true
        }
      }}
      spacing={PACKAGE_LIST_ITEM_SPACING}
      sx={{ flex: 1 }}
    />
  )
}
