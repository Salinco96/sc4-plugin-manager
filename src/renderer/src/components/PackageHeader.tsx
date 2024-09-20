import { useState } from "react"

import { Box, Typography } from "@mui/material"

import { PackageID } from "@common/packages"
import { FlexBox } from "@components/FlexBox"
import { PackageActions } from "@components/PackageActions"
import { PackageTags } from "@components/PackageTags"
import { useCurrentVariant, usePackageInfo } from "@utils/packages"

import { PackageImages } from "./PackageImages"
import { PackageTools } from "./PackageTools"
import { Thumbnail } from "./Thumbnail"

export function PackageHeader({ packageId }: { packageId: PackageID }): JSX.Element {
  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useCurrentVariant(packageId)

  const [openImages, setOpenImages] = useState(false)

  return (
    <FlexBox alignItems="center" pb={2} px={2}>
      {!!variantInfo.images?.length && (
        <PackageImages
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
      <Box flexGrow={1} pr={2}>
        <Typography variant="h6">
          {packageInfo.name} (v{variantInfo.version})
        </Typography>
        <FlexBox alignItems="center">
          <Typography variant="body2">
            {packageId}#{variantInfo.id}
          </Typography>
          <PackageTools packageId={packageId} />
        </FlexBox>
        <PackageTags packageId={packageId} />
      </Box>
      <PackageActions packageId={packageId} />
    </FlexBox>
  )
}
