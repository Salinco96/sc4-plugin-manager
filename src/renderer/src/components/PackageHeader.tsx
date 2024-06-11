import { Folder as FilesIcon, Settings as ConfigIcon } from "@mui/icons-material"
import { Box, IconButton, Typography } from "@mui/material"

import { FlexBox } from "@renderer/components/FlexBox"
import { PackageActions } from "@renderer/components/PackageActions"
import { PackageTags } from "@renderer/components/PackageTags"
import { useCurrentVariant, usePackageInfo } from "@renderer/utils/packages"
import { useStoreActions } from "@renderer/utils/store"

export function PackageHeader({ packageId }: { packageId: string }): JSX.Element {
  const actions = useStoreActions()
  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useCurrentVariant(packageId)

  return (
    <FlexBox alignItems="center" pb={2} px={2}>
      <Box flexGrow={1} pr={2}>
        <Typography variant="h6">
          {packageInfo.name} (v{variantInfo.version})
        </Typography>
        <Typography sx={{ alignItems: "center", display: "flex", gap: 0.5 }} variant="body2">
          {packageInfo.id}#{variantInfo.id}
          {variantInfo.installed && (
            <IconButton
              aria-label="Open configuration file"
              color="inherit"
              onClick={() => actions.openPackageConfig(packageId)}
              size="small"
              sx={{ padding: 0 }}
              title="Open configuration file"
            >
              <ConfigIcon fontSize="inherit" />
            </IconButton>
          )}
          {variantInfo.installed && (
            <IconButton
              aria-label="Open installed files"
              color="inherit"
              onClick={() => actions.openPackageFile(packageId, variantInfo.id, "")}
              size="small"
              sx={{ padding: 0 }}
              title="Open installed files"
            >
              <FilesIcon fontSize="inherit" />
            </IconButton>
          )}
        </Typography>
        <PackageTags packageId={packageId} />
      </Box>
      <PackageActions packageId={packageId} />
    </FlexBox>
  )
}
