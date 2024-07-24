import { useCurrentProfile, useStoreActions } from "@utils/store"

import { OptionsForm } from "./OptionsForm"
import { useProfileOptions } from "./useProfileOptions"

export function ProfileOptionsForm(): JSX.Element {
  const actions = useStoreActions()
  const profileInfo = useCurrentProfile()
  const options = useProfileOptions()

  return (
    <OptionsForm
      disabled={!profileInfo}
      onChange={(option, newValue) => actions.setProfileOption(option.id, newValue)}
      options={options}
      values={profileInfo?.options ?? {}}
    />
  )
}
