import { useMemo } from "react"

import { Box } from "@mui/material"
import { difference, isEmpty, keys, sort } from "@salinco/nice-utils"
import { Virtuoso } from "react-virtuoso"

import type { PackageID } from "@common/packages"
import { FlexRow } from "@components/FlexBox"
import { Header } from "@components/Header"
import { ListItem } from "@components/ListItem"
import { Page, useLocation, useNavigation } from "@utils/navigation"
import { type MatchResult, isHexSearch, searchIndex, toHexSearch } from "@utils/search"

import { MAXIS_FILES } from "@common/plugins"
import { store } from "@stores/main"
import { EmptyPackageList } from "./EmptyPackageList"
import { MatchResults } from "./MatchResults"
import { PackageListItem } from "./PackageListItem"

export function PackageList({ packageIds }: { packageIds: PackageID[] }): JSX.Element {
  const { page } = useLocation()
  const { search } = store.usePackageFilters()

  const index = store.useIndex()

  const { fromPackageId } = useNavigation()

  const searchResults = useMemo(() => {
    if (index && isHexSearch(search) && page === Page.Packages) {
      return searchIndex(index, toHexSearch(search))
    }

    return {}
  }, [index, page, search])

  const initialIndex = useMemo(() => {
    if (fromPackageId) {
      const index = packageIds.indexOf(fromPackageId)
      if (index >= 0) {
        return index
      }
    }

    return 0
  }, [fromPackageId, packageIds])

  if (!packageIds.length && isEmpty(searchResults)) {
    return <EmptyPackageList />
  }

  return (
    <Virtuoso
      components={{ Header: SearchResults }}
      context={{ searchResults }}
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

function SearchResults({
  context: { searchResults = {} } = {},
}: {
  context?: {
    searchResults?: { [path in string]: MatchResult[] }
  }
}): JSX.Element {
  const paths = [
    ...MAXIS_FILES.filter(path => searchResults[path]),
    ...sort(difference(keys(searchResults), MAXIS_FILES)),
  ]

  return (
    <>
      {paths.map(path => (
        <FlexRow fullWidth key={path} pt={2} px={2}>
          <ListItem
            header={Header}
            location={{ data: { path }, page: Page.Plugins }}
            subtitle={path}
            title={path.split("/").slice(-1)[0]}
          >
            <MatchResults results={searchResults[path]} />
          </ListItem>
        </FlexRow>
      ))}
    </>
  )
}
