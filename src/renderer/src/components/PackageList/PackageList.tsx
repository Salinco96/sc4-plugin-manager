import { useMemo } from "react"

import { Box } from "@mui/material"
import { Virtuoso } from "react-virtuoso"

import type { PackageID } from "@common/packages"
import { Page, useHistory } from "@utils/navigation"

import { EmptyPackageList } from "./EmptyPackageList"
import { PackageListItem } from "./PackageListItem"

export function PackageList({ packageIds }: { packageIds: PackageID[] }): JSX.Element {
  const history = useHistory()

  const initialIndex = useMemo(() => {
    if (history.previous?.page === Page.PackageView) {
      const index = packageIds.indexOf(history.previous.data.packageId)
      if (index >= 0) {
        return index
      }
    }

    return 0
  }, [history, packageIds])

  if (packageIds.length === 0) {
    return <EmptyPackageList />
  }

  return (
    <Virtuoso
      data={packageIds}
      itemContent={(index, packageId) => (
        <Box padding={2} paddingTop={index === 0 ? 2 : 0}>
          <PackageListItem packageId={packageId} />
        </Box>
      )}
      initialTopMostItemIndex={initialIndex}
      style={{ flex: 1, width: "100%" }}
    />
  )
}
