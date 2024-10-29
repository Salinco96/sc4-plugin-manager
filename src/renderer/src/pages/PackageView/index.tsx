import { ArrowBack as BackIcon } from "@mui/icons-material"
import { IconButton, Tooltip } from "@mui/material"
import { useTranslation } from "react-i18next"

import { PackageID } from "@common/packages"
import { FlexBox } from "@components/FlexBox"
import { PackageHeader } from "@components/PackageHeader"
import { useHistory } from "@utils/navigation"

import { PackageViewTabs } from "../../components/PackageViewTabs/PackageViewTabs"

function PackageView({ packageId }: { packageId: PackageID }): JSX.Element | null {
  const history = useHistory()

  const { t } = useTranslation("General")

  return (
    <FlexBox direction="column" height="100%" pt={1}>
      <Tooltip arrow placement="right" title="Go back">
        <IconButton
          aria-label={t("back")}
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
