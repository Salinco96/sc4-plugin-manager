import { Switch } from "@mui/material"

import { ProfileInfo } from "@common/types"
import { FlexBox } from "@renderer/components/FlexBox"
import { Text } from "@renderer/components/Text"
import { useStoreActions } from "@renderer/utils/store"

export function ProfileSettingSwitchField({
  disabled,
  label,
  name,
  profileInfo,
}: {
  disabled?: boolean
  label: string
  name: string
  profileInfo: ProfileInfo
}): JSX.Element | null {
  const actions = useStoreActions()

  return (
    <FlexBox alignItems="center" gap={2} minHeight={40}>
      <Text maxLines={3} sx={{ flex: 1 }}>
        {label}
      </Text>
      <Switch
        checked={profileInfo.externals[name]}
        color="primary"
        disabled={disabled}
        inputRef={ref => {
          if (ref) {
            ref.checked = profileInfo.externals[name]
          }
        }}
        onClick={async event => {
          event.preventDefault()
          const value = (event.target as HTMLInputElement).checked
          if (value !== profileInfo.externals[name]) {
            await actions.editProfile(profileInfo.id, { externals: { [name]: value } })
          }
        }}
      />
    </FlexBox>
  )
}
