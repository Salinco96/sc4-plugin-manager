import { memo, useCallback, useState } from "react"

import { Card, CardActions, CardContent, Link } from "@mui/material"

import type { PackageID } from "@common/packages"
import { FlexBox } from "@components/FlexBox"
import { PackageActions } from "@components/PackageActions"
import { PackageBanners } from "@components/PackageBanners/PackageBanners"
import { PackageTools } from "@components/PackageTools"
import { Text } from "@components/Text"
import { Thumbnail } from "@components/Thumbnail"
import { ImageViewer } from "@components/Viewer/ImageViewer"
import { Page, useHistory } from "@utils/navigation"
import { useCurrentVariant, usePackageInfo } from "@utils/packages"

import { PackageTags } from "../Tags/PackageTags"

export const PackageListItem = memo(function PackageListItem({
  packageId,
}: {
  packageId: PackageID
}): JSX.Element {
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

  return (
    <Card elevation={active ? 8 : 1} sx={{ display: "flex", height: "100%" }}>
      <CardContent sx={{ flexGrow: 1, overflow: "hidden" /* TODO: Overflowing tags */ }}>
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
              onClick={openPackageView}
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
                onClick={openPackageView}
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
      </CardContent>
      <CardActions sx={{ padding: 2 }}>
        <PackageActions
          filtered={history.current.page !== Page.PackageView}
          packageId={packageId}
        />
      </CardActions>
    </Card>
  )
})
