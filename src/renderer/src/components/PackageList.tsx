import { useMemo, useRef } from "react"

import { getCategory, getState } from "@common/types"
import { history } from "@renderer/stores/navigation"
import { useCurrentProfile, useStore } from "@renderer/utils/store"

import { PackageListItem } from "./PackageListItem"
import { VirtualList } from "./VirtualList"

export function PackageList(): JSX.Element {
  const currentProfile = useCurrentProfile()
  const allPackages = useStore(store => store.remotePackages)
  const packageFilters = useStore(store => store.packageFilters)

  const filteredPackages = useMemo(() => {
    let packages = Object.values(allPackages || {})

    if (packageFilters.categories.length) {
      packages = packages.filter(info => packageFilters.categories.includes(getCategory(info)))
    }

    if (packageFilters.states.length) {
      packages = packages.filter(info =>
        packageFilters.states.some(state => getState(info, state, currentProfile)),
      )
    }

    if (packageFilters.search.trim().length > 2) {
      packages = packages.filter(info =>
        (info.id + info.name).toLowerCase().includes(packageFilters.search.trim().toLowerCase()),
      )
    }

    packages.sort((a, b) => a.id.localeCompare(b.id))

    return packages
  }, [allPackages, currentProfile, packageFilters])

  const scrolled = useRef(false)

  return (
    <VirtualList
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
          const index = filteredPackages.findIndex(info => info.id === fromPackageId)
          if (index >= 0) {
            list.scrollToItem(index, "start")
          }

          scrolled.current = true
        }
      }}
      spacing={16}
      sx={{ height: "100%" }}
    />
  )
}