import type { OptionInfo } from "@common/options"
import { type PackageID, checkCondition } from "@common/packages"
import { store } from "@stores/main"

export function usePackageOptions(packageId: PackageID): OptionInfo[] {
  const features = store.useFeatures()
  const profileInfo = store.useCurrentProfile()
  const profileOptions = store.useProfileOptions()
  const settings = store.useSettings()
  const variantInfo = store.useCurrentVariant(packageId)

  const options =
    variantInfo.options
      ?.map<OptionInfo>(option => {
        if (option.global) {
          const globalOption = profileOptions.find(profileOption => profileOption.id === option.id)
          if (globalOption) {
            return {
              ...globalOption,
              global: true,
              label: option.label ?? globalOption?.label,
              section: option.section,
            }
          }
        }

        return option
      })
      .filter(option =>
        checkCondition(
          option.condition,
          packageId,
          variantInfo,
          profileInfo,
          profileOptions,
          features,
          settings,
        ),
      ) ?? []

  return options
}
