import { checkCondition } from "@common/packages"
import { useCurrentProfile, useStore, useStoreActions } from "@utils/store"

import { OptionsForm } from "./OptionsForm"
import { useProfileOptions } from "./useProfileOptions"

export function ProfileOptionsForm(): JSX.Element {
  const actions = useStoreActions()
  const profileInfo = useCurrentProfile()
  const options = useProfileOptions()
  const profileOptions = useStore(store => store.globalOptions)
  const features = useStore(store => store.features)

  return (
    <OptionsForm
      checkCondition={condition =>
        checkCondition(condition, undefined, undefined, profileInfo, profileOptions, features)
      }
      disabled={!profileInfo}
      onChange={(option, newValue) => actions.setProfileOption(option.id, newValue)}
      options={options}
      values={profileInfo?.options ?? {}}
    />
  )
}
