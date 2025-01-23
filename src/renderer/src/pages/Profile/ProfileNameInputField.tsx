import { useEffect, useState } from "react"

import { type SxProps, TextField } from "@mui/material"
import { useTranslation } from "react-i18next"

import type { ProfileInfo } from "@common/profiles"
import { updateProfile } from "@stores/actions"

export function ProfileNameInputField({
  profileInfo,
  sx,
}: {
  profileInfo: ProfileInfo
  sx?: SxProps
}): JSX.Element {
  const [name, setName] = useState(profileInfo.name)

  // Update defaultValue if name changes in some other way
  useEffect(() => setName(profileInfo.name), [profileInfo.name])

  const { t } = useTranslation("Profile")

  return (
    <TextField
      fullWidth
      label={t("name.label")}
      onBlur={async event => {
        const value = event.target.value
        if (value === profileInfo.name) {
          return
        }

        if (value && (await updateProfile(profileInfo.id, { name: value }))) {
          return
        }

        setName(profileInfo.name)
      }}
      onChange={event => {
        const value = event.target.value
        setName(value)
      }}
      required
      sx={sx}
      value={name}
      variant="standard"
    />
  )
}
