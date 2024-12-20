import { checkCondition } from "@common/packages"
import {
  useCurrentProfile,
  useFeatures,
  useSettings,
  useStore,
  useStoreActions,
} from "@utils/store"

import { OptionsForm } from "./OptionsForm"
import { useProfileOptions } from "./useProfileOptions"

export function ProfileOptionsForm(): JSX.Element {
  const actions = useStoreActions()
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.profileOptions)
  const options = useProfileOptions()
  const features = useFeatures()
  const settings = useSettings()

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
      onChange={(option, newValue) => actions.setProfileOption(option.id, newValue)}
      options={options}
      values={profileInfo?.options ?? {}}
    />
  )
}
