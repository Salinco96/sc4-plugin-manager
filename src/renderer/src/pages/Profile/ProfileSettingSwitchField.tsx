import { FormControlLabel, Switch } from "@mui/material"

import { ProfileSettings } from "@common/profiles"
import { ProfileInfo } from "@common/types"
import { useStoreActions } from "@renderer/utils/store"

export function ProfileSettingSwitchField<T extends keyof ProfileSettings>({
  disabled,
  label,
  name,
  profileInfo,
}: {
  disabled?: boolean
  label: string
  name: T
  profileInfo: ProfileInfo & { settings: { [K in T]: boolean } }
}): JSX.Element | null {
  const actions = useStoreActions()

  return (
    <FormControlLabel
      checked={profileInfo.settings[name]}
      control={<Switch color="primary" />}
      disabled={disabled}
      label={label}
      labelPlacement="start"
      onChange={async event => {
        const value = (event.target as HTMLInputElement).checked
        if (value !== profileInfo.settings[name]) {
          actions.editProfile(profileInfo.id, { settings: { [name]: value } })
        }
      }}
      slotProps={{ typography: { sx: { flex: 1 } } }}
      sx={{ marginLeft: 0 }}
    />
  )
}
