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

function PackageViewInner({ packageId }: { packageId: PackageID }): JSX.Element {
  const isLoading = useStore(store => !store.packages)
  const exists = useStore(store => !!store.packages?.[packageId])

  const { t } = useTranslation("PackageView")

  if (isLoading) {
    return <Loader />
  }

  if (exists) {
    return (
      <>
        <PackageHeader packageId={packageId} />
        <PackageViewTabs packageId={packageId} />
      </>
    )
  }

  return (
    <FlexBox
      alignItems="center"
      direction="column"
      flex={1}
      fontSize={40}
      justifyContent="center"
      height="100%"
    >
      <NoResultIcon fontSize="inherit" />
      <Typography variant="subtitle1">{t("missing", { packageId })}</Typography>
    </FlexBox>
  )
}

function PackageView({ packageId }: { packageId: PackageID }): JSX.Element {
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
      <PackageViewInner packageId={packageId} />
    </FlexBox>
  )
}

export default PackageView
