import { useCurrentProfile, useStoreActions } from "@utils/store"

import { OptionsForm } from "./OptionsForm"
import { usePackageOptions } from "./usePackageOptions"

export function PackageOptionsForm({ packageId }: { packageId: string }): JSX.Element {
  const actions = useStoreActions()
  const profileInfo = useCurrentProfile()
  const options = usePackageOptions(packageId)

  return (
    <OptionsForm
      disabled={!profileInfo}
      onChange={(option, newValue) => {
        if (option.global) {
          actions.setProfileOption(option.id, newValue)
        } else {
          actions.setPackageOption(packageId, option.id, newValue)
        }
      }}
      options={options}
      values={{ ...profileInfo?.packages[packageId]?.options, ...profileInfo?.options }}
    />
  )
}
