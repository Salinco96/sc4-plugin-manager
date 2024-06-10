import { useMemo, useRef } from "react"

import { SearchOff as NoResultIcon } from "@mui/icons-material"
import { Typography } from "@mui/material"

import { PackageCategory, PackageState, getCategory, getState } from "@common/types"
import { getCurrentVariant, getPackageStatus } from "@renderer/pages/PackageView"
import { useHistory } from "@renderer/utils/navigation"
import { useCurrentProfile, useStore } from "@renderer/utils/store"

import { FlexBox } from "./FlexBox"
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

  // TODO: Messy filtering - should be moved to Zustand
  const filteredPackages = useMemo(() => {
    const packages = Object.values(allPackages || {}).filter(info => {
      const variant = getCurrentVariant(info, currentProfile)

      if (packageFilters.categories.length) {
        if (!packageFilters.categories.includes(getCategory(variant))) {
          return false
        }
      }

      if (packageFilters.state) {
        if (!getState(packageFilters.state, info, variant.id, currentProfile)) {
          return false
        }
      }

      if (!packageFilters.onlyErrors && !packageFilters.onlyUpdates) {
        if (!packageFilters.dependencies) {
          if (getCategory(variant) === PackageCategory.DEPENDENCIES) {
            return false
          }
        }

        if (!packageFilters.experimental) {
          if (getState(PackageState.EXPERIMENTAL, info, variant.id, currentProfile)) {
            return false
          }
        }

        if (!packageFilters.incompatible) {
          if (getState(PackageState.INCOMPATIBLE, info, variant.id, currentProfile)) {
            return false
          }
        }
      }

      if (packageFilters.onlyErrors) {
        if (!getState(PackageState.ERROR, info, variant.id, currentProfile)) {
          return false
        }
      }

      if (packageFilters.onlyUpdates) {
        if (!getState(PackageState.OUTDATED, info, variant.id, currentProfile)) {
          return false
        }
      }

      if (packageFilters.search.trim().length > 2) {
        const search = [info.id, info.name].join("|").toLowerCase()
        if (!search.includes(packageFilters.search.trim().toLowerCase())) {
          return false
        }
      }

      return true
    })

    packages.sort((a, b) => a.id.localeCompare(b.id))

    return packages.map(info => info.id)
  }, [allPackages, currentProfile, packageFilters])

  const scrolled = useRef(false)

  if (filteredPackages.length === 0) {
    return (
      <FlexBox
        alignItems="center"
        direction="column"
        fontSize={40}
        height="100%"
        justifyContent="center"
        width="100%"
      >
        <NoResultIcon fontSize="inherit" />
        <Typography variant="subtitle1">No packages found for these filters</Typography>
      </FlexBox>
    )
  }

  return (
    <VirtualList<string>
      baseSize={PACKAGE_LIST_ITEM_BASE_SIZE}
      items={filteredPackages}
      itemComponent={PackageListItem}
      itemSize={(packageId, size) => {
        const packageInfo = useStore.getState().packages?.[packageId]

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
