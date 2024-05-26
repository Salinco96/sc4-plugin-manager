import { useEffect, useState } from "react"

import Box from "@mui/material/Box"
import FormControl from "@mui/material/FormControl"
import FormControlLabel from "@mui/material/FormControlLabel"
import FormGroup from "@mui/material/FormGroup"
import Switch from "@mui/material/Switch"
import TextField from "@mui/material/TextField"

import { useCurrentProfile, useStore, useStoreActions } from "@renderer/utils/store"

function Profile(): JSX.Element {
  const actions = useStoreActions()
  const currentProfile = useCurrentProfile()
  const packageGroups = useStore(store => store.packageGroups)

  const [name, setName] = useState(currentProfile?.name ?? "")

  // Update defaultValue if name changes in some other way
  useEffect(() => {
    setName(currentProfile?.name ?? "")
  }, [currentProfile?.name])

  if (!currentProfile) {
    return <Box />
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%", padding: 2 }}>
      <TextField
        fullWidth
        label="Profile name"
        onBlur={async event => {
          const value = event.currentTarget.value
          if (value === currentProfile.name) {
            return
          }

          if (value) {
            const success = await actions.editProfile(currentProfile.id, { name: value })
            if (success) {
              return
            }
          }

          setName(currentProfile.name)
        }}
        onChange={event => {
          const value = event.currentTarget.value
          setName(value)
        }}
        required
        value={name}
        variant="standard"
      />
      <FormControl component="fieldset">
        <FormGroup>
          <FormControlLabel
            checked={currentProfile.settings.darknite}
            control={<Switch color="primary" />}
            disabled={!!packageGroups?.darknite}
            label="Are you using a DarkNite mod?"
            labelPlacement="start"
            onChange={async event => {
              const value = (event.target as HTMLInputElement).checked
              if (value !== currentProfile.settings.darknite) {
                actions.editProfile(currentProfile.id, {
                  settings: { darknite: value },
                })
              }
            }}
            slotProps={{ typography: { sx: { flex: 1 } } }}
            sx={{ marginLeft: 0 }}
          />
          <FormControlLabel
            checked={currentProfile.settings.cam}
            control={<Switch color="primary" />}
            disabled={!!packageGroups?.cam}
            label="Are you using the Colossus Addon Mod?"
            labelPlacement="start"
            onChange={async event => {
              const value = (event.target as HTMLInputElement).checked
              if (value !== currentProfile.settings.cam) {
                actions.editProfile(currentProfile.id, {
                  settings: { cam: value },
                })
              }
            }}
            slotProps={{ typography: { sx: { flex: 1 } } }}
            sx={{ marginLeft: 0 }}
          />
        </FormGroup>
      </FormControl>
    </Box>
  )
}

export default Profile
