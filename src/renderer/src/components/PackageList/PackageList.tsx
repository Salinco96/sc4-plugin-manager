import { useMemo } from "react"

import { Box, Typography } from "@mui/material"
import { collect, isEmpty, mapValues } from "@salinco/nice-utils"
import { Virtuoso } from "react-virtuoso"

import type { PackageID } from "@common/packages"
import { FlexRow } from "@components/FlexBox"
import { Header } from "@components/Header"
import { ListItem } from "@components/ListItem"
import { Page, useLocation, useNavigation } from "@utils/navigation"
import { type MatchResult, getMatchingContents, isHexSearch } from "@utils/search"

import { store } from "@stores/main"
import { EmptyPackageList } from "./EmptyPackageList"
import { PackageListItem } from "./PackageListItem"

export function PackageList({ packageIds }: { packageIds: PackageID[] }): JSX.Element {
  const { page } = useLocation()
  const { search } = store.usePackageFilters()
  const externalPlugins = store.useExternals()
  const maxisExemplars = store.useMaxis()

  const { fromPackageId } = useNavigation()

  const matchingMaxisContents = useMemo(() => {
    if (maxisExemplars && isHexSearch(search) && page === Page.Packages) {
      return getMatchingContents(maxisExemplars, search.trim().toLowerCase())
    }
  }, [maxisExemplars, page, search])

  const matchingPluginContents = useMemo(() => {
    if (isHexSearch(search) && page === Page.Packages) {
      return mapValues(externalPlugins, contents => {
        const matching = getMatchingContents(contents, search.trim().toLowerCase())
        return matching.length ? matching : undefined
      })
    }

    return {}
  }, [externalPlugins, page, search])

  const initialIndex = useMemo(() => {
    if (fromPackageId) {
      const index = packageIds.indexOf(fromPackageId)
      if (index >= 0) {
        return index
      }
    }

    return 0
  }, [fromPackageId, packageIds])

  if (!packageIds.length && !matchingMaxisContents?.length && isEmpty(matchingPluginContents)) {
    return <EmptyPackageList />
  }

  return (
    <Virtuoso
      components={{ Header: SearchResults }}
      context={{ matchingMaxisContents, matchingPluginContents }}
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
  context: { matchingMaxisContents, matchingPluginContents = {} } = {},
}: {
  context?: {
    matchingMaxisContents?: MatchResult[]
    matchingPluginContents?: { [path in string]?: MatchResult[] }
  }
}): JSX.Element {
  return (
    <>
      {!!matchingMaxisContents?.length && (
        <FlexRow fullWidth pt={2} px={2}>
          <ListItem header={Header} subtitle="SimCity_1.dat" title="SimCity 4 (base game)">
            <Typography variant="body2">
              <b>Match results:</b>
            </Typography>
            <ul style={{ marginBlockStart: 0, marginBlockEnd: 0 }}>
              {matchingMaxisContents.map(({ name, type }) => (
                <Typography component="li" key={type} variant="body2">
                  {type}: {name}
                </Typography>
              ))}
            </ul>
          </ListItem>
        </FlexRow>
      )}

      {collect(matchingPluginContents, (contents, pluginPath) => (
        <FlexRow fullWidth pt={2} px={2}>
          <ListItem
            header={Header}
            subtitle={pluginPath}
            title={pluginPath.split("/").slice(-1)[0]}
          >
            <Typography variant="body2">
              <b>Match results:</b>
            </Typography>
            <ul style={{ marginBlockStart: 0, marginBlockEnd: 0 }}>
              {contents.map(({ name, type }) => (
                <Typography component="li" key={type} variant="body2">
                  {type}: {name}
                </Typography>
              ))}
            </ul>
          </ListItem>
        </FlexRow>
      ))}
    </>
  )
}
