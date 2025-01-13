import { type PackageID, checkCondition } from "@common/packages"
import { useCurrentVariant } from "@utils/packages"
import {
  useCurrentProfile,
  useFeatures,
  useSettings,
  useStore,
  useStoreActions,
} from "@utils/store"

import { isEmpty } from "@salinco/nice-utils"
import { OptionsForm } from "./OptionsForm"
import { usePackageOptions } from "./usePackageOptions"

export default function PackageOptionsForm({ packageId }: { packageId: PackageID }): JSX.Element {
  const actions = useStoreActions()
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.profileOptions)
  const options = usePackageOptions(packageId)

  const variantInfo = useCurrentVariant(packageId)
  const features = useFeatures()
  const settings = useSettings()

  const packageValues = profileInfo?.packages[packageId]?.options ?? {}
  const profileValues = profileInfo?.options ?? {}
  const values = { ...profileValues, ...packageValues }

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
      resetDisabled={isEmpty(packageValues)}
      values={values}
    />
  )
}
