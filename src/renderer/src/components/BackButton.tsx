import { ArrowBack as BackIcon } from "@mui/icons-material"
import { IconButton, Tooltip } from "@mui/material"
import { useTranslation } from "react-i18next"

import { useHistory } from "@utils/navigation"

export function BackButton(): JSX.Element {
  const history = useHistory()

  const { t } = useTranslation("General")

  return (
    <Tooltip arrow placement="right" title={t("back", { ns: "General" })}>
      <IconButton
        aria-label={t("back", { ns: "General" })}
        color="inherit"
        onClick={() => history.back()}
        size="small"
      >
        <BackIcon />
      </IconButton>
    </Tooltip>
  )
}
