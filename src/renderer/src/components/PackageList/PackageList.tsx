import { useRef } from "react"

import { PackageID } from "@common/packages"
import { Page, useHistory } from "@utils/navigation"
import { PACKAGE_LIST_ITEM_BASE_SIZE, usePackageListItemSize } from "@utils/packages"

import { EmptyPackageList } from "./EmptyPackageList"
import { PackageListItem } from "./PackageListItem"
import { VirtualList } from "./VirtualList"

const PACKAGE_LIST_ITEM_SPACING = 16
const PACKAGE_LIST_PADDING = 16

export function PackageList({ packageIds }: { packageIds: PackageID[] }): JSX.Element {
  const getItemSize = usePackageListItemSize()
  const history = useHistory()

  const scrolled = useRef(false)

  if (packageIds.length === 0) {
    return <EmptyPackageList />
  }

  return (
    <VirtualList<PackageID>
      baseSize={PACKAGE_LIST_ITEM_BASE_SIZE}
      items={packageIds}
      itemComponent={PackageListItem}
      itemSize={getItemSize}
      paddingBottom={PACKAGE_LIST_PADDING}
      paddingLeft={PACKAGE_LIST_PADDING}
      paddingRight={PACKAGE_LIST_PADDING}
      paddingTop={PACKAGE_LIST_PADDING}
      ref={list => {
        list?.resetAfterIndex(0)

        // Scroll to package upon coming back from package view
        if (list && history.previous?.page === Page.PackageView && !scrolled.current) {
          const fromPackageId = history.previous.data.packageId
          const index = packageIds.indexOf(fromPackageId)
          if (index >= 0) {
            list.scrollToItem(index, "start")
          }

          scrolled.current = true
        }
      }}
      spacing={PACKAGE_LIST_ITEM_SPACING}
      sx={{ flex: 1, height: "100%" }}
    />
  )
}
