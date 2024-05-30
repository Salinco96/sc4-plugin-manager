import { useMemo, useRef } from "react"

import { PackageCategory, PackageState, getCategory, getState } from "@common/types"
import { useHistory } from "@renderer/utils/navigation"
import { useCurrentProfile, useStore } from "@renderer/utils/store"

import { PackageListItem } from "./PackageListItem"
import { VirtualList } from "./VirtualList"

const PACKAGE_LIST_ITEM_BASE_SIZE = 180
const PACKAGE_LIST_ITEM_BANNER_SIZE = 72
const PACKAGE_LIST_ITEM_DESCRIPTION_SIZE = 56

export function PackageList(): JSX.Element {
  const currentProfile = useCurrentProfile()
  const allPackages = useStore(store => store.packages)
  const packageFilters = useStore(store => store.packageFilters)
  const history = useHistory()

  const filteredPackages = useMemo(() => {
    let packages = Object.values(allPackages || {})

    if (packageFilters.categories.length) {
      packages = packages.filter(info =>
        packageFilters.categories.includes(getCategory(info.variants[info.status.variantId])),
      )
    }

    if (packageFilters.state) {
      packages = packages.filter(info => getState(info, packageFilters.state!, currentProfile))
    }

    if (!packageFilters.onlyErrors && !packageFilters.onlyUpdates) {
      if (!packageFilters.dependencies) {
        packages = packages.filter(
          info =>
            getCategory(info.variants[info.status.variantId]) !== PackageCategory.DEPENDENCIES,
        )
      }

      if (!packageFilters.experimental) {
        packages = packages.filter(
          info => !getState(info, PackageState.EXPERIMENTAL, currentProfile),
        )
      }

      if (!packageFilters.incompatible) {
        packages = packages.filter(
          info => !getState(info, PackageState.INCOMPATIBLE, currentProfile),
        )
      }
    }

    if (packageFilters.onlyErrors) {
      packages = packages.filter(info => getState(info, PackageState.ERROR, currentProfile))
    }

    if (packageFilters.onlyUpdates) {
      packages = packages.filter(info => getState(info, PackageState.OUTDATED, currentProfile))
    }

    if (packageFilters.search.trim().length > 2) {
      packages = packages.filter(info =>
        (info.id + "|" + info.name)
          .toLowerCase()
          .includes(packageFilters.search.trim().toLowerCase()),
      )
    }

    packages.sort((a, b) => a.id.localeCompare(b.id))

    return packages.map(info => info.id)
  }, [allPackages, currentProfile, packageFilters])

  const scrolled = useRef(false)

  return (
    <VirtualList<string>
      baseSize={PACKAGE_LIST_ITEM_BASE_SIZE}
      items={filteredPackages}
      itemComponent={PackageListItem}
      itemSize={(packageId, size) => {
        const packageInfo = useStore.getState().packages?.[packageId]

        if (packageInfo) {
          const variantInfo = packageInfo.variants[packageInfo.status.variantId]
          if (variantInfo.deprecated) {
            size += PACKAGE_LIST_ITEM_BANNER_SIZE
          }

          if (variantInfo.experimental) {
            size += PACKAGE_LIST_ITEM_BANNER_SIZE
          }

          if (variantInfo.incompatible) {
            size += PACKAGE_LIST_ITEM_BANNER_SIZE * variantInfo.incompatible.length
          }

          if (variantInfo.update) {
            size += PACKAGE_LIST_ITEM_BANNER_SIZE
          }

          if (!variantInfo.description) {
            size -= PACKAGE_LIST_ITEM_DESCRIPTION_SIZE
          }
        }

        return size
      }}
      paddingBottom={16}
      paddingLeft={16}
      paddingRight={16}
      paddingTop={16}
      ref={list => {
        list?.resetAfterIndex(0)

        // Scroll to package upon coming back from package view
        if (list && history.previous?.page === "PackageView" && !scrolled.current) {
          const fromPackageId = history.previous.data.packageId
          const index = filteredPackages.indexOf(fromPackageId)
          if (index >= 0) {
            list.scrollToItem(index, "start")
          }

          scrolled.current = true
        }
      }}
      spacing={16}
      sx={{ flex: 1 }}
    />
  )
}
