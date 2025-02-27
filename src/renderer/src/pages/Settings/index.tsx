import {
  CheckCircle as AppliedIcon,
  Cancel as NotAppliedIcon,
  Update as UpdateIcon,
} from "@mui/icons-material"
import { Button, FormGroup, Link, Paper, Tooltip, Typography, useTheme } from "@mui/material"
import { useTranslation } from "react-i18next"

import { FlexCol, FlexRow } from "@components/FlexBox"
import { Text } from "@components/Text"
import {
  check4GBPatch,
  checkDgVoodoo,
  openDataRepository,
  openExecutableDirectory,
  openInstallationDirectory,
  removeUnusedPackages,
} from "@stores/actions"
import { store } from "@stores/main"

function Settings(): JSX.Element {
  const settings = store.useSettings()
  const theme = useTheme()

  const { t } = useTranslation("Settings")

  return (
    <FlexCol fullHeight gap={2} p={2}>
      <Paper
        component="fieldset"
        elevation={0}
        sx={{ border: `1px solid ${theme.palette.divider}` }}
      >
        <FormGroup>
          <FlexRow centered gap={2} height={38}>
            <Typography sx={{ flex: 1 }}>{t("install.path.label")}</Typography>
            {settings?.install?.path ? (
              <Tooltip arrow placement="left" title={t("install.path.actions.explorer")}>
                <Text
                  color="primary"
                  maxLines={1}
                  onClick={openInstallationDirectory}
                  sx={{ cursor: "pointer" }}
                >
                  {settings.install.path}
                </Text>
              </Tooltip>
            ) : (
              t("install.path.emptyValue")
            )}
          </FlexRow>

          <FlexRow centered gap={2} height={38}>
            <Typography sx={{ flex: 1 }}>{t("install.version.label")}</Typography>
            {settings?.install?.version ? (
              <Tooltip arrow placement="left" title={t("install.version.actions.explorer")}>
                <Text
                  color="primary"
                  maxLines={1}
                  onClick={openExecutableDirectory}
                  sx={{ cursor: "pointer" }}
                >
                  {settings.install.version}
                </Text>
              </Tooltip>
            ) : (
              t("install.version.emptyValue")
            )}
          </FlexRow>

          <FlexRow centered gap={1} height={38}>
            <Typography sx={{ flex: 1 }}>{t("install.patched.label")}</Typography>
            {settings?.install?.patched ? (
              <FlexRow
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
              </FlexRow>
            ) : (
              <FlexRow
                centered
                onClick={check4GBPatch}
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
              </FlexRow>
            )}
          </FlexRow>

          <FlexRow centered gap={1} height={38}>
            <Typography sx={{ flex: 1 }}>{t("install.voodoo.label")}</Typography>
            {settings?.install?.voodoo ? (
              <FlexRow
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
                <span>{t("install.voodoo.applied")}</span>
              </FlexRow>
            ) : (
              <FlexRow
                centered
                onClick={checkDgVoodoo}
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
                <span>{t("install.voodoo.apply")}</span>
              </FlexRow>
            )}
          </FlexRow>

          <FlexRow centered gap={1} height={38}>
            <Typography sx={{ flex: 1 }}>
              {t(settings?.env.dev ? "version.labelDev" : "version.label")}
            </Typography>
            {settings?.version ?? t("version.emptyValue")}
            {settings?.version && !settings?.update && (
              <FlexRow
                centered
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
              </FlexRow>
            )}

            {settings?.version && !!settings.update && (
              <FlexRow
                centered
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
                <Link href={settings.update.url} target="_blank" rel="noreferrer">
                  {t("version.updateAvailable", { version: settings.update.version })}
                </Link>
              </FlexRow>
            )}
          </FlexRow>

          <FlexRow centered gap={2} height={38}>
            <Typography sx={{ flex: 1 }}>{t("db.label")}</Typography>

            {settings?.db ? (
              <Tooltip arrow placement="left" title={t("db.actions.explorer")}>
                <Text
                  color="primary"
                  maxLines={1}
                  onClick={openDataRepository}
                  sx={{ cursor: "pointer" }}
                >
                  {settings.db.path ?? settings.db.url}
                </Text>
              </Tooltip>
            ) : (
              t("db.emptyValue")
            )}
          </FlexRow>
        </FormGroup>
      </Paper>

      <Button
        color="error"
        onClick={removeUnusedPackages}
        title={t("actions.removeUnusedPackages.description")}
        variant="outlined"
      >
        {t("actions.removeUnusedPackages.label")}
      </Button>
    </FlexCol>
  )
}

export default Settings
