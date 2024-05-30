import { Box, FormControl, FormGroup } from "@mui/material"

import { FlexBox } from "@renderer/components/FlexBox"
import { useCurrentProfile, useStore } from "@renderer/utils/store"

import { ProfileNameInputField } from "./ProfileNameInputField"
import { ProfileSettingSwitchField } from "./ProfileSettingSwitchField"

function Profile(): JSX.Element {
  const conflictGroups = useStore(store => store.conflictGroups)
  const profileInfo = useCurrentProfile()

  if (!profileInfo) {
    return <Box />
  }

  return (
    <FlexBox direction="column" height="100%" gap={2} p={2}>
      <ProfileNameInputField profileInfo={profileInfo} />
      <FormControl component="fieldset">
        <FormGroup>
          <ProfileSettingSwitchField
            disabled={!!conflictGroups?.darknite}
            label="Are you using a DarkNite mod?"
            name="darknite"
            profileInfo={profileInfo}
          />
          <ProfileSettingSwitchField
            disabled={!!conflictGroups?.cam}
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
