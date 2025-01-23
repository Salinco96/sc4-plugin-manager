import { checkCondition } from "@common/packages"

import { setProfileOption } from "@stores/actions"
import { store } from "@stores/main"
import { OptionsForm } from "./OptionsForm"
import { useProfileOptions } from "./useProfileOptions"

export function ProfileOptionsForm(): JSX.Element {
  const options = useProfileOptions()

  const features = store.useFeatures()
  const profileInfo = store.useCurrentProfile()
  const profileOptions = store.useProfileOptions()
  const settings = store.useSettings()

  return (
    <OptionsForm
      checkCondition={condition =>
        checkCondition(
          condition,
          undefined,
          undefined,
          profileInfo,
          profileOptions,
          features,
          settings,
        )
      }
      disabled={!profileInfo}
      onChange={(option, newValue) => setProfileOption(option.id, newValue)}
      options={options}
      values={profileInfo?.options ?? {}}
    />
  )
}
