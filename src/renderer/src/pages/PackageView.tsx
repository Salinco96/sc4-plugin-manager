import BackIcon from "@mui/icons-material/ArrowBack"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"

import { PackageActions } from "@renderer/components/PackageActions"
import { PackageTags } from "@renderer/components/PackageTags"
import { history } from "@renderer/stores/navigation"
import { useStore } from "@renderer/utils/store"

function PackageView({ packageId }: { packageId: string }): JSX.Element | null {
  const info = useStore(store => store.remotePackages?.[packageId])

  if (!info) {
    return null
  }

  return (
    <Box sx={{ paddingTop: 1, paddingBottom: 1 }}>
      <Tooltip arrow placement="right" title="Go back">
        <IconButton
          aria-label="Go back"
          color="inherit"
          onClick={() => history.back()}
          size="small"
          sx={{ marginLeft: 1 }}
        >
          <BackIcon />
        </IconButton>
      </Tooltip>
      <Box sx={{ alignItems: "center", display: "flex", paddingLeft: 2, paddingRight: 2 }}>
        <Box sx={{ flexGrow: 1, paddingRight: 2 }}>
          <Typography variant="h6">
            {info.name} (v{info.installed ?? info.version})
          </Typography>
          <Typography variant="body2">{info.id}</Typography>
          <PackageTags packageInfo={info} />
        </Box>
        <PackageActions packageInfo={info} />
      </Box>
    </Box>
  )
}

export default PackageView
