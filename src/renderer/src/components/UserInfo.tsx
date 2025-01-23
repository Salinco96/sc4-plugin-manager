import { ContentCopy as CopyIcon } from "@mui/icons-material"
import { IconButton, Tooltip, Typography } from "@mui/material"
import { useTranslation } from "react-i18next"

import type { ApplicationState } from "@common/state"
import { showSuccessToast } from "@stores/ui"

import { FlexRow } from "./FlexBox"

export function UserInfo({
  session: { displayName, sessionId, userId },
}: { session: NonNullable<ApplicationState["simtropolis"]> }): JSX.Element {
  const { t } = useTranslation("AppBar")

  return (
    <FlexRow centered gap={1}>
      {displayName ? (
        <Tooltip title={`${t("userId.label")}: ${userId}`}>
          <Typography variant="body1" color="inherit" noWrap>
            {displayName}
          </Typography>
        </Tooltip>
      ) : (
        <Tooltip title={t("userId.description")}>
          <Typography variant="body1" color="inherit" noWrap>
            {t("userId.label")}: {userId}
          </Typography>
        </Tooltip>
      )}

      {sessionId && (
        <Tooltip title={t("actions.sessionKey.description")}>
          <IconButton
            color="inherit"
            onClick={async () => {
              await navigator.clipboard.writeText(sessionId)
              showSuccessToast(t("actions.sessionKey.success"))
            }}
            size="small"
          >
            <CopyIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      )}
    </FlexRow>
  )
}
