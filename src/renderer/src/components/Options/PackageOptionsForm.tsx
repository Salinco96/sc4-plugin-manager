import { checkCondition } from "@common/packages"
import { useCurrentVariant } from "@utils/packages"
import { useCurrentProfile, useStore, useStoreActions } from "@utils/store"

import { OptionsForm } from "./OptionsForm"
import { usePackageOptions } from "./usePackageOptions"

export function PackageOptionsForm({ packageId }: { packageId: string }): JSX.Element {
  const actions = useStoreActions()
  const profileInfo = useCurrentProfile()
  const options = usePackageOptions(packageId)

  const variantInfo = useCurrentVariant(packageId)
  const profileOptions = useStore(store => store.globalOptions)
  const features = useStore(store => store.features)

  return (
    <OptionsForm
      checkCondition={condition =>
        checkCondition(condition, packageId, variantInfo, profileInfo, profileOptions, features)
      }
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
