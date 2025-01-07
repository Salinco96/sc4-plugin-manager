import type { ToolID } from "@common/tools"
import { FlexBox } from "@components/FlexBox"
import { Loader } from "@components/Loader"
import { Tabs } from "@components/Tabs"
import { ToolHeader } from "@components/ToolHeader"
import { toolViewTabs } from "@components/ToolViewTabs/tabs"
import { ArrowBack as BackIcon, SearchOff as NoResultIcon } from "@mui/icons-material"
import { IconButton, Tooltip, Typography } from "@mui/material"
import { useHistory } from "@utils/navigation"
import { useStore } from "@utils/store"
import { useTranslation } from "react-i18next"

function ToolViewInner({ toolId }: { toolId: ToolID }): JSX.Element {
  const isLoading = useStore(store => !store.tools)
  const exists = useStore(store => !!store.tools?.[toolId])

  const { t } = useTranslation("ToolView")

  if (isLoading) {
    return <Loader />
  }

  if (exists) {
    return (
      <FlexBox direction="column" gap={2}>
        <ToolHeader toolId={toolId} />
        <Tabs tabs={toolViewTabs} toolId={toolId} />
      </FlexBox>
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
      <Typography variant="subtitle1">{t("missing", { toolId })}</Typography>
    </FlexBox>
  )
}

function ToolView({ toolId }: { toolId: ToolID }): JSX.Element {
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
      <ToolViewInner toolId={toolId} />
    </FlexBox>
  )
}

export default ToolView
