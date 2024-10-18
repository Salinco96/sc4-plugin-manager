import {
  FormControlLabel,
  FormGroup,
  Paper,
  Switch,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material"
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
          <FormControlLabel
            checked={!!settings?.install?.patched}
            control={<Switch color="primary" />}
            disabled={!settings?.install || !!settings?.install?.patched}
            label={t("install.patched.label")}
            labelPlacement="start"
            onChange={async event => {
              const value = (event.target as HTMLInputElement).checked
              if (value) {
                await actions.check4GBPatch()
              }
            }}
            slotProps={{ typography: { sx: { flex: 1 } } }}
            sx={{ marginLeft: 0 }}
            title={settings?.install?.patched ? t("install.patched.reason.applied") : undefined}
          />
        </FormGroup>
      </Paper>
    </FlexBox>
  )
}

export default Settings
