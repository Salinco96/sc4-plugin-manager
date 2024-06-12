import { Settings as ConfigIcon } from "@mui/icons-material"
import { FormControl, FormGroup, IconButton, TextField, Tooltip } from "@mui/material"

import { FlexBox } from "@components/FlexBox"
import { useCurrentProfile, useStoreActions } from "@utils/store"

import { ProfileNameInputField } from "./ProfileNameInputField"
import { ProfileSettingSwitchField } from "./ProfileSettingSwitchField"

function Profile(): JSX.Element {
  const profileInfo = useCurrentProfile()
  const actions = useStoreActions()

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
              <Tooltip arrow placement="left" title="Open configuration file">
                <IconButton onClick={() => actions.openProfileConfig(profileInfo.id)} size="small">
                  <ConfigIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ),
          }}
          disabled
          fullWidth
          label="Profile ID"
          required
          sx={{ flex: 1 }}
          value={profileInfo.id}
          variant="standard"
        />
      </FlexBox>
      <FormControl component="fieldset">
        <FormGroup>
          <ProfileSettingSwitchField
            label="Have you installed a DarkNite mod outside of the Manager?"
            name="darknite"
            profileInfo={profileInfo}
          />
          <ProfileSettingSwitchField
            label="Have you installed the Colossus Addon Mod outside of the Manager?"
            name="cam"
            profileInfo={profileInfo}
          />
          <ProfileSettingSwitchField
            label="Do you have cars driving on the left?"
            name="rhd"
            profileInfo={profileInfo}
          />
        </FormGroup>
      </FormControl>
    </FlexBox>
  )
}

export default Profile
