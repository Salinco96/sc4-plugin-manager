import { Card, CardActions, CardContent, Divider, Link, Typography } from "@mui/material"
import { memo, useCallback, useState } from "react"

import type { PackageID } from "@common/packages"
import { FlexBox } from "@components/FlexBox"
import { PackageActions } from "@components/PackageActions"
import { PackageBanners } from "@components/PackageBanners/PackageBanners"
import { PackageTools } from "@components/PackageTools"
import { PackageTags } from "@components/Tags/PackageTags"
import { Text } from "@components/Text"
import { Thumbnail } from "@components/Thumbnail"
import { ImageViewer } from "@components/Viewer/ImageViewer"
import { Page, useHistory } from "@utils/navigation"
import { useCurrentVariant, usePackageInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"
import { useMatchingContents } from "./useMatchingContents"

export const PackageListItem = memo(function PackageListItem({
  packageId,
}: {
  packageId: PackageID
}): JSX.Element {
  const actions = useStoreActions()
  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useCurrentVariant(packageId)
  const history = useHistory()

  const [focus, setFocus] = useState(false)
  const [hover, setHover] = useState(false)

  const active = focus || hover

  const openPackageView = useCallback(() => {
    history.push({ page: Page.PackageView, data: { packageId } })
  }, [history, packageId])

  const [openImages, setOpenImages] = useState(false)

  const matchingContents = useMatchingContents(variantInfo)

  return (
    <Card elevation={active ? 8 : 1} sx={{ display: "flex", height: "100%" }}>
      <CardContent sx={{ width: "100%" }}>
        <FlexBox direction="row">
          <FlexBox direction="column" flex={1} sx={{ overflow: "hidden" }}>
            {!!variantInfo.images?.length && (
              <ImageViewer
                images={variantInfo.images}
                onClose={() => setOpenImages(false)}
                open={openImages}
              />
            )}

            <FlexBox direction="row">
              {variantInfo.thumbnail && (
                <Thumbnail
                  disabled={!variantInfo.images?.length}
                  mr={2}
                  mt={1}
                  size={84}
                  onClick={() => setOpenImages(true)}
                  src={variantInfo.thumbnail}
                />
              )}

              <FlexBox direction="column">
                <Link
                  color="inherit"
                  onBlur={() => setFocus(false)}
                  onClick={() => openPackageView()}
                  onFocus={event => setFocus(event.target === event.currentTarget)}
                  onKeyDown={event => event.key === "Enter" && openPackageView()}
                  onMouseEnter={() => setHover(true)}
                  onMouseLeave={() => setHover(false)}
                  sx={{
                    cursor: "pointer",
                    display: "block",
                    textDecoration: active ? "underline" : "unset",
                    width: "fit-content",
                  }}
                  tabIndex={0}
                >
                  <Text maxLines={1} variant="h6">
                    {packageInfo.name} (v{variantInfo.version})
                  </Text>
                </Link>
                <FlexBox alignItems="center">
                  <Link
                    color="inherit"
                    onClick={() => openPackageView()}
                    onMouseEnter={() => setHover(true)}
                    onMouseLeave={() => setHover(false)}
                    sx={{ cursor: "pointer", textDecoration: active ? "underline" : "unset" }}
                  >
                    <Text maxLines={1} variant="body2">
                      {packageId}#{variantInfo.id}
                    </Text>
                  </Link>
                  <PackageTools packageId={packageId} />
                </FlexBox>
                <PackageTags packageId={packageId} />
              </FlexBox>
            </FlexBox>
            {(variantInfo.summary ?? variantInfo.description) && (
              <Text
                maxLines={variantInfo.summary ? undefined : 2}
                sx={{ fontStyle: variantInfo.summary ? "italic" : undefined, marginTop: 2 }}
                title={variantInfo.description}
                variant="body2"
              >
                {variantInfo.summary ?? variantInfo.description}
              </Text>
            )}
            <PackageBanners packageId={packageId} />
          </FlexBox>
          <CardActions sx={{ padding: 2 }}>
            <PackageActions
              filtered={history.current.page !== Page.PackageView}
              packageId={packageId}
            />
          </CardActions>
        </FlexBox>

        {!!matchingContents?.length && (
          <>
            <Divider sx={{ marginY: 2 }} />
            <Typography variant="body2">
              <b>Match results:</b>
            </Typography>
            <ul style={{ marginBlockStart: 0, marginBlockEnd: 0 }}>
              {matchingContents.map(({ element, name, tab, type }) => (
                <Typography component="li" key={type} variant="body2">
                  <Link
                    color="inherit"
                    onClick={() => {
                      actions.setPackageViewTab(tab, element)
                      openPackageView()
                    }}
                    sx={{
                      cursor: "pointer",
                      textDecoration: "none",
                      "&:hover": { textDecoration: "underline" },
                    }}
                  >
                    {type}: {name}
                  </Link>
                </Typography>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
})
