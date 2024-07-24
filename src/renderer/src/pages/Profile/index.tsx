import { Settings as ConfigIcon } from "@mui/icons-material"
import { FormControl, FormGroup, IconButton, TextField, Tooltip } from "@mui/material"
import { useTranslation } from "react-i18next"

import { Feature } from "@common/types"
import { FlexBox } from "@components/FlexBox"
import { ProfileOptionsForm } from "@components/Options"
import { useCurrentProfile, useStoreActions } from "@utils/store"

import { ProfileNameInputField } from "./ProfileNameInputField"
import { ProfileSettingFeatureSwitchField } from "./ProfileSettingSwitchField"

function Profile(): JSX.Element {
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
            label={t("externals.label", { name: t("darknite.full", { ns: "Features" }) })}
            profileInfo={profileInfo}
          />
          <ProfileSettingFeatureSwitchField
            feature={Feature.CAM}
            label={t("externals.label", { name: t("cam.full", { ns: "Features" }) })}
            profileInfo={profileInfo}
          />
          <ProfileSettingFeatureSwitchField
            feature={Feature.NAM}
            label={t("externals.label", { name: t("nam.full", { ns: "Features" }) })}
            profileInfo={profileInfo}
          />
        </FormGroup>
      </FormControl>
      <ProfileOptionsForm />
    </FlexBox>
  )
}

export default Profile
