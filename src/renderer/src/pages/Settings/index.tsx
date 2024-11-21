import {
  CheckCircle as AppliedIcon,
  Cancel as NotAppliedIcon,
  Update as UpdateIcon,
} from "@mui/icons-material"
import { Button, FormGroup, Paper, Tooltip, Typography, useTheme } from "@mui/material"
import { useTranslation } from "react-i18next"

import { FlexBox } from "@components/FlexBox"
import { Text } from "@components/Text"
import { useSettings, useStoreActions } from "@utils/store"

function Settings(): JSX.Element {
  const settings = useSettings()
  const actions = useStoreActions()
  const theme = useTheme()

  const { t } = useTranslation("Settings")

  return (
    <FlexBox direction="column" height="100%" gap={2} p={2}>
      <Paper
        component="fieldset"
        elevation={0}
        sx={{ border: `1px solid ${theme.palette.divider}` }}
      >
        <FormGroup>
          <FlexBox alignItems="center" height={38} gap={2}>
            <Typography sx={{ flex: 1 }}>{t("install.path.label")}</Typography>
            {settings?.install?.path ? (
              <Tooltip arrow placement="left" title={t("install.path.actions.explorer")}>
                <Text
                  color="primary"
                  maxLines={1}
                  onClick={() => actions.openInstallationDirectory()}
                  sx={{ cursor: "pointer" }}
                >
                  {settings.install.path}
                </Text>
              </Tooltip>
            ) : (
              t("install.path.emptyValue")
            )}
          </FlexBox>
          <FlexBox alignItems="center" height={38} gap={2}>
            <Typography sx={{ flex: 1 }}>{t("install.version.label")}</Typography>
            {settings?.install?.version ? (
              <Tooltip arrow placement="left" title={t("install.version.actions.explorer")}>
                <Text
                  color="primary"
                  maxLines={1}
                  onClick={() => actions.openExecutableDirectory()}
                  sx={{ cursor: "pointer" }}
                >
                  {settings.install.version}
                </Text>
              </Tooltip>
            ) : (
              t("install.version.emptyValue")
            )}
          </FlexBox>
          <FlexBox alignItems="center" height={38} gap={1}>
            <Typography sx={{ flex: 1 }}>{t("install.patched.label")}</Typography>
            {settings?.install?.patched ? (
              <FlexBox
                alignItems="center"
                sx={{
                  "& span": {
                    overflow: "hidden",
                    textWrap: "nowrap",
                    transition: "width 0.3s",
                    width: 0,
                  },
                  "&:hover span": {
                    marginLeft: 1,
                    width: 56,
                  },
                }}
              >
                <AppliedIcon color="success" />
                <span>{t("install.patched.applied")}</span>
              </FlexBox>
            ) : (
              <FlexBox
                alignItems="center"
                onClick={() => actions.check4GBPatch()}
                sx={{
                  cursor: "pointer",
                  "& span": {
                    overflow: "hidden",
                    textWrap: "nowrap",
                    transition: "width 0.3s",
                    width: 0,
                  },
                  "&:hover span": {
                    marginLeft: 1,
                    width: 100,
                  },
                }}
              >
                <NotAppliedIcon color="error" />
                <span>{t("install.patched.apply")}</span>
              </FlexBox>
            )}
          </FlexBox>
          <FlexBox alignItems="center" height={38} gap={1}>
            <Typography sx={{ flex: 1 }}>{t("version.label")}</Typography>
            {settings?.version ?? t("version.emptyValue")}
            {settings?.version && !settings?.update && (
              <FlexBox
                alignItems="center"
                sx={{
                  "& span": {
                    overflow: "hidden",
                    textWrap: "nowrap",
                    transition: "width 0.3s",
                    width: 0,
                  },
                  "&:hover span": {
                    marginLeft: 1,
                    width: 192,
                  },
                }}
              >
                <AppliedIcon color="success" />
                <span>{t("version.updated")}</span>
              </FlexBox>
            )}
            {settings?.version && !!settings.update && (
              <FlexBox
                alignItems="center"
                sx={{
                  "& a": {
                    overflow: "hidden",
                    textWrap: "nowrap",
                    transition: "width 0.3s",
                    width: 0,
                  },
                  "&:hover a": {
                    marginLeft: 1,
                    width: 188,
                  },
                }}
              >
                <UpdateIcon color="warning" />
                <a href={settings.update.url} target="_blank" rel="noreferrer">
                  {t("version.updateAvailable", { version: settings.update.version })}
                </a>
              </FlexBox>
            )}
          </FlexBox>
        </FormGroup>
      </Paper>
      <Button
        color="error"
        onClick={() => actions.clearUnusedPackages()}
        title={t("actions.clearUnusedPackages.description")}
        variant="outlined"
      >
        {t("actions.clearUnusedPackages.label")}
      </Button>
    </FlexBox>
  )
}

export default Settings
