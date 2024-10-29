import { PackageID, checkCondition } from "@common/packages"
import { useCurrentVariant } from "@utils/packages"
import {
  useConfigs,
  useCurrentProfile,
  useFeatures,
  useSettings,
  useStoreActions,
} from "@utils/store"

import { OptionsForm } from "./OptionsForm"
import { usePackageOptions } from "./usePackageOptions"

export function PackageOptionsForm({ packageId }: { packageId: PackageID }): JSX.Element {
  const { profileOptions } = useConfigs()

  const actions = useStoreActions()
  const profileInfo = useCurrentProfile()
  const options = usePackageOptions(packageId)

  const variantInfo = useCurrentVariant(packageId)
  const features = useFeatures()
  const settings = useSettings()

  const values = {
    ...profileInfo?.packages[packageId]?.options,
    ...profileInfo?.options,
  }

  return (
    <OptionsForm
      checkCondition={condition =>
        checkCondition(
          condition,
          packageId,
          variantInfo,
          profileInfo,
          profileOptions,
          features,
          settings,
        )
      }
      disabled={!profileInfo}
      onChange={(option, newValue) => {
        if (option.global) {
          actions.setProfileOption(option.id, newValue)
        } else {
          actions.setPackageOption(packageId, option.id, newValue)
        }
      }}
      onReset={() => {
        actions.resetPackageOptions(packageId)
      }}
      options={options}
      values={values}
    />
  )
}
