import { Settings as ConfigIcon } from "@mui/icons-material"
import { FormControl, FormGroup, IconButton, TextField, Tooltip } from "@mui/material"

import { FlexBox } from "@renderer/components/FlexBox"
import { useCurrentProfile, useStore, useStoreActions } from "@renderer/utils/store"

import { ProfileNameInputField } from "./ProfileNameInputField"
import { ProfileSettingSwitchField } from "./ProfileSettingSwitchField"

function Profile(): JSX.Element {
  const conflictGroups = useStore(store => store.conflictGroups)
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
            disabled={conflictGroups?.darknite?.some(id => id !== "<external>")}
            label="Are you using a DarkNite mod?"
            name="darknite"
            profileInfo={profileInfo}
          />
          <ProfileSettingSwitchField
            disabled={conflictGroups?.cam?.some(id => id !== "<external>")}
            label="Are you using the Colossus Addon Mod?"
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
