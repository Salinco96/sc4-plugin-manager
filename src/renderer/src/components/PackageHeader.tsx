import { useState } from "react"

import { Box } from "@mui/material"

import type { PackageID } from "@common/packages"
import { FlexBox } from "@components/FlexBox"
import { PackageActions } from "@components/PackageActions"
import { useCurrentVariant, usePackageInfo } from "@utils/packages"

import { PackageTools } from "./PackageTools"
import { PackageTags } from "./Tags/PackageTags"
import { Text } from "./Text"
import { Thumbnail } from "./Thumbnail"
import { ImageViewer } from "./Viewer/ImageViewer"

export function PackageHeader({ packageId }: { packageId: PackageID }): JSX.Element {
  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useCurrentVariant(packageId)

  const [openImages, setOpenImages] = useState(false)

  return (
    <FlexBox alignItems="center" pb={2} px={2}>
      {!!variantInfo.images?.length && (
        <ImageViewer
          images={variantInfo.images}
          onClose={() => setOpenImages(false)}
          open={openImages}
        />
      )}
      {!!variantInfo.thumbnail && (
        <Thumbnail
          disabled={!variantInfo.images?.length}
          mr={2}
          mt={1}
          onClick={() => setOpenImages(true)}
          size={84}
          src={variantInfo.thumbnail}
        />
      )}
      <Box flex={1} mr={2} overflow="hidden">
        <Text maxLines={1} variant="h6">
          {packageInfo.name} (v{variantInfo.version})
        </Text>
        <FlexBox alignItems="center">
          <Text maxLines={1} variant="body2">
            {packageId}#{variantInfo.id}
          </Text>
          <PackageTools packageId={packageId} />
        </FlexBox>
        <PackageTags packageId={packageId} />
      </Box>
      <PackageActions packageId={packageId} />
    </FlexBox>
  )
}
