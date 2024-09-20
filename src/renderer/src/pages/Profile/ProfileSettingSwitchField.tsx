import { Switch } from "@mui/material"

import { ProfileInfo } from "@common/profiles"
import { Feature } from "@common/types"
import { FlexBox } from "@components/FlexBox"
import { Text } from "@components/Text"
import { useStoreActions } from "@utils/store"

export function ProfileSettingFeatureSwitchField({
  disabled,
  feature,
  label,
  profileInfo,
}: {
  disabled?: boolean
  feature: Feature
  label: string
  profileInfo: ProfileInfo
}): JSX.Element | null {
  const actions = useStoreActions()

  return (
    <FlexBox alignItems="center" gap={2} minHeight={40}>
      <Text maxLines={3} sx={{ flex: 1 }}>
        {label}
      </Text>
      <Switch
        checked={!!profileInfo.features[feature]}
        color="primary"
        disabled={disabled}
        inputRef={ref => {
          if (ref) {
            ref.checked = profileInfo.features[feature]
          }
        }}
        onClick={async event => {
          event.preventDefault()
          const { checked } = event.target as HTMLInputElement
          if (checked !== profileInfo.features[feature]) {
            await actions.updateProfile(profileInfo.id, { features: { [feature]: checked } })
          }
        }}
      />
    </FlexBox>
  )
}
