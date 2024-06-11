import { ArrowBack as BackIcon } from "@mui/icons-material"
import { IconButton, Tooltip } from "@mui/material"

import { FlexBox } from "@renderer/components/FlexBox"
import { PackageHeader } from "@renderer/components/PackageHeader"
import { useHistory } from "@renderer/utils/navigation"

import { PackageViewTabs } from "./PackageViewTabs/PackageViewTabs"

function PackageView({ packageId }: { packageId: string }): JSX.Element | null {
  const history = useHistory()

  return (
    <FlexBox direction="column" height="100%" pt={1}>
      <Tooltip arrow placement="right" title="Go back">
        <IconButton
          aria-label="Go back"
          color="inherit"
          onClick={() => history.back()}
          size="small"
          sx={{ alignSelf: "flex-start", marginLeft: 1 }}
        >
          <BackIcon />
        </IconButton>
      </Tooltip>
      <PackageHeader packageId={packageId} />
      <PackageViewTabs packageId={packageId} />
    </FlexBox>
  )
}

export default PackageView
