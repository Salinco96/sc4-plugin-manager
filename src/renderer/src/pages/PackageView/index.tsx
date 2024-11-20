import { ArrowBack as BackIcon, SearchOff as NoResultIcon } from "@mui/icons-material"
import { IconButton, Tooltip, Typography } from "@mui/material"
import { useTranslation } from "react-i18next"

import type { PackageID } from "@common/packages"
import { FlexBox } from "@components/FlexBox"
import { Loader } from "@components/Loader"
import { PackageHeader } from "@components/PackageHeader"
import { useHistory } from "@utils/navigation"
import { useStore } from "@utils/store"

import { PackageViewTabs } from "../../components/PackageViewTabs/PackageViewTabs"

function PackageView({ packageId }: { packageId: PackageID }): JSX.Element | null {
  const history = useHistory()

  const exists = useStore(store => (store.packages ? !!store.packages[packageId] : undefined))

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
      {exists ? (
        <>
          <PackageHeader packageId={packageId} />
          <PackageViewTabs packageId={packageId} />
        </>
      ) : exists === false ? (
        <FlexBox
          alignItems="center"
          direction="column"
          flex={1}
          fontSize={40}
          justifyContent="center"
          height="100%"
        >
          <NoResultIcon fontSize="inherit" />
          <Typography variant="subtitle1">Package {packageId} does not exist</Typography>
        </FlexBox>
      ) : (
        <Loader />
      )}
    </FlexBox>
  )
}

export default PackageView
