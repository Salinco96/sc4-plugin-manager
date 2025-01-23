import { Settings as ConfigIcon } from "@mui/icons-material"
import { Button, FormControl, FormGroup, IconButton, TextField, Tooltip } from "@mui/material"
import { size } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import { Feature } from "@common/types"
import { FlexCol, FlexRow } from "@components/FlexBox"
import { ProfileOptionsForm } from "@components/Options/ProfileOptionsForm"

import { openProfileConfig, removeProfile } from "@stores/actions"
import { store } from "@stores/main"
import { ProfileNameInputField } from "./ProfileNameInputField"
import { ProfileSettingFeatureSwitchField } from "./ProfileSettingSwitchField"

function Profile(): JSX.Element | null {
  const canRemove = store.useStore(state => state.profiles && size(state.profiles) > 1)
  const profileInfo = store.useCurrentProfile()

  const { t } = useTranslation("Profile")

  if (!profileInfo) {
    return null
  }

  return (
    <FlexCol fullHeight gap={2} p={2}>
      <FlexRow gap={2}>
        <ProfileNameInputField profileInfo={profileInfo} sx={{ flex: 2 }} />
        <TextField
          InputProps={{
            endAdornment: (
              <Tooltip arrow placement="left" title={t("actions.open")}>
                <IconButton onClick={() => openProfileConfig(profileInfo.id)} size="small">
                  <ConfigIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ),
          }}
          disabled
          fullWidth
          label={t("id.label")}
          required
          sx={{ flex: 1 }}
          value={profileInfo.id}
          variant="standard"
        />
      </FlexRow>

      <FormControl component="fieldset">
        <FormGroup>
          <ProfileSettingFeatureSwitchField
            feature={Feature.DARKNITE}
            label={t("externals.darknite")}
            profileInfo={profileInfo}
          />

          <ProfileSettingFeatureSwitchField
            feature={Feature.CAM}
            label={t("externals.cam")}
            profileInfo={profileInfo}
          />

          <ProfileSettingFeatureSwitchField
            feature={Feature.NAM}
            label={t("externals.nam")}
            profileInfo={profileInfo}
          />
        </FormGroup>
      </FormControl>

      <ProfileOptionsForm />

      <Button
        color="error"
        disabled={!canRemove}
        onClick={() => removeProfile(profileInfo.id)}
        variant="outlined"
      >
        {t("actions.remove.label")}
      </Button>
    </FlexCol>
  )
}

export default Profile
