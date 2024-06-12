import { Box, Typography } from "@mui/material"

import { FlexBox } from "@components/FlexBox"
import { PackageActions } from "@components/PackageActions"
import { PackageTags } from "@components/PackageTags"
import { useCurrentVariant, usePackageInfo } from "@utils/packages"

import { PackageTools } from "./PackageTools"

export function PackageHeader({ packageId }: { packageId: string }): JSX.Element {
  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useCurrentVariant(packageId)

  return (
    <FlexBox alignItems="center" pb={2} px={2}>
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
