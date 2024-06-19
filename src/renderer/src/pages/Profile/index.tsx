import { Settings as ConfigIcon } from "@mui/icons-material"
import { FormControl, FormGroup, IconButton, TextField, Tooltip } from "@mui/material"
import { useTranslation } from "react-i18next"

import { FlexBox } from "@components/FlexBox"
import { useCurrentProfile, useStoreActions } from "@utils/store"

import { ProfileNameInputField } from "./ProfileNameInputField"
import { ProfileSettingSwitchField } from "./ProfileSettingSwitchField"

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
          <ProfileSettingSwitchField
            label={t("externals.label", { name: t("darknite.full", { ns: "ConflictGroups" }) })}
            name="darknite"
            profileInfo={profileInfo}
          />
          <ProfileSettingSwitchField
            label={t("externals.label", { name: t("cam.full", { ns: "ConflictGroups" }) })}
            name="cam"
            profileInfo={profileInfo}
          />
          <ProfileSettingSwitchField label={t("rhd.label")} name="rhd" profileInfo={profileInfo} />
        </FormGroup>
      </FormControl>
    </FlexBox>
  )
}

export default Profile
