import { useMemo } from "react"

import { Box, Card, CardContent, Divider, Typography } from "@mui/material"
import { Virtuoso } from "react-virtuoso"

import type { PackageID } from "@common/packages"
import { Page, useHistory } from "@utils/navigation"

import { FlexBox } from "@components/FlexBox"
import { useStore } from "@utils/store"
import { EmptyPackageList } from "./EmptyPackageList"
import { PackageListItem } from "./PackageListItem"
import { useMatchingContents } from "./useMatchingContents"

export function PackageList({ packageIds }: { packageIds: PackageID[] }): JSX.Element {
  const exemplars = useStore(store => store.exemplars)
  const history = useHistory()

  const contents = useMemo(() => {
    return {
      buildingFamilies: { "*": exemplars.buildingFamilies },
      buildings: { "*": exemplars.buildings },
      lots: { "*": exemplars.lots },
      propFamilies: { "*": exemplars.propFamilies },
      props: { "*": exemplars.props },
    }
  }, [exemplars])

  const matchingContents = useMatchingContents(contents)

  const initialIndex = useMemo(() => {
    if (history.previous?.page === Page.PackageView) {
      const index = packageIds.indexOf(history.previous.data.packageId)
      if (index >= 0) {
        return index
      }
    }

    return 0
  }, [history, packageIds])

  if (!packageIds.length && !matchingContents?.length) {
    return <EmptyPackageList />
  }

  return (
    <>
      {!!matchingContents?.length && (
        <FlexBox width="100%">
          <Card elevation={1} sx={{ display: "flex", margin: 2, width: "100%" }}>
            <CardContent sx={{ width: "100%" }}>
              <Typography variant="h6">SimCity 4 (base game)</Typography>
              <Divider sx={{ marginY: 2 }} />
              <Typography variant="body2">
                <b>Match results:</b>
              </Typography>
              <ul style={{ marginBlockStart: 0, marginBlockEnd: 0 }}>
                {matchingContents.map(({ name, type }) => (
                  <Typography component="li" key={type} variant="body2">
                    {type}: {name}
                  </Typography>
                ))}
              </ul>
            </CardContent>
          </Card>
        </FlexBox>
      )}
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
    </>
  )
}
