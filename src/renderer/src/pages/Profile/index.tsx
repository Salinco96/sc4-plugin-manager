import { Settings as ConfigIcon } from "@mui/icons-material"
import { Button, FormControl, FormGroup, IconButton, TextField, Tooltip } from "@mui/material"
import { size } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import { Feature } from "@common/types"
import { FlexBox } from "@components/FlexBox"
import { ProfileOptionsForm } from "@components/Options/ProfileOptionsForm"
import { useCurrentProfile, useStore, useStoreActions } from "@utils/store"

import { ProfileNameInputField } from "./ProfileNameInputField"
import { ProfileSettingFeatureSwitchField } from "./ProfileSettingSwitchField"

function Profile(): JSX.Element {
  const profileCount = useStore(store => size(store.profiles ?? {}))
  const profileInfo = useCurrentProfile()
  const actions = useStoreActions()

  const { t } = useTranslation("Profile")

  if (!profileInfo) {
    return <FlexBox />
  }

  return (
    <FlexBox direction="column" height="100%" gap={2} p={2}>
      <FlexBox direction="row" gap={2}>
        <ProfileNameInputField profileInfo={profileInfo} sx={{ flex: 2 }} />
        <TextField
          InputProps={{
            endAdornment: (
              <Tooltip arrow placement="left" title={t("actions.open")}>
                <IconButton onClick={() => actions.openProfileConfig(profileInfo.id)} size="small">
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
      </FlexBox>
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
        disabled={profileCount === 1}
        onClick={() => actions.removeProfile(profileInfo.id)}
        variant="outlined"
      >
        {t("actions.remove.label")}
      </Button>
    </FlexBox>
  )
}

export default Profile
