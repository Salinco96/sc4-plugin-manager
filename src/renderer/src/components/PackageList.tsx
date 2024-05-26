import { useMemo, useRef } from "react"

import { PackageCategory, PackageState, getCategory, getState } from "@common/types"
import { history } from "@renderer/stores/navigation"
import { useCurrentProfile, useStore } from "@renderer/utils/store"

import { PackageListItem } from "./PackageListItem"
import { VirtualList } from "./VirtualList"

export function PackageList(): JSX.Element {
  const currentProfile = useCurrentProfile()
  const allPackages = useStore(store => store.packages)
  const packageFilters = useStore(store => store.packageFilters)

  const filteredPackages = useMemo(() => {
    let packages = Object.values(allPackages || {})

    if (packageFilters.categories.length) {
      packages = packages.filter(info => packageFilters.categories.includes(getCategory(info)))
    }

    if (packageFilters.state) {
      packages = packages.filter(info => getState(info, packageFilters.state!, currentProfile))
    }

    if (!packageFilters.onlyErrors && !packageFilters.onlyUpdates) {
      if (!packageFilters.dependencies) {
        packages = packages.filter(info => getCategory(info) !== PackageCategory.DEPENDENCIES)
      }

      if (!packageFilters.incompatible) {
        packages = packages.filter(info => getState(info, PackageState.COMPATIBLE, currentProfile))
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
      items={filteredPackages}
      itemComponent={PackageListItem}
      itemSize={160}
      paddingBottom={16}
      paddingLeft={16}
      paddingRight={16}
      paddingTop={16}
      ref={list => {
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
