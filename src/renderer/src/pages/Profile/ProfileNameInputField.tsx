import { useEffect, useState } from "react"

import { TextField } from "@mui/material"

import { ProfileInfo } from "@common/types"
import { useStoreActions } from "@renderer/utils/store"

export function ProfileNameInputField({ profileInfo }: { profileInfo: ProfileInfo }): JSX.Element {
  const actions = useStoreActions()

  const [name, setName] = useState(profileInfo.name)

  // Update defaultValue if name changes in some other way
  useEffect(() => setName(profileInfo.name), [profileInfo.name])

  return (
    <TextField
      fullWidth
      label="Profile name"
      onBlur={async event => {
        const value = event.target.value
        if (value === profileInfo.name) {
          return
        }

        if (value && (await actions.editProfile(profileInfo.id, { name: value }))) {
          return
        }

        setName(profileInfo.name)
      }}
      onChange={event => {
        const value = event.target.value
        setName(value)
      }}
      required
      value={name}
      variant="standard"
    />
  )
}
