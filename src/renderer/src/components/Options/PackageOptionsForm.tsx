import { isEmpty } from "@salinco/nice-utils"

import { type PackageID, checkCondition } from "@common/packages"
import { store } from "@stores/main"

import { resetPackageOptions, setPackageOption, setProfileOption } from "@stores/actions"
import { OptionsForm } from "./OptionsForm"
import { usePackageOptions } from "./usePackageOptions"

export default function PackageOptionsForm({ packageId }: { packageId: PackageID }): JSX.Element {
  const options = usePackageOptions(packageId)

  const features = store.useFeatures()
  const profileInfo = store.useCurrentProfile()
  const profileOptions = store.useProfileOptions()
  const settings = store.useSettings()
  const variantInfo = store.useCurrentVariant(packageId)

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
          setProfileOption(option.id, newValue)
        } else {
          setPackageOption(packageId, option.id, newValue)
        }
      }}
      onReset={() => resetPackageOptions(packageId)}
      options={options}
      resetDisabled={isEmpty(packageValues)}
      values={values}
    />
  )
}
