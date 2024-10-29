import { OptionInfo } from "@common/options"
import { PackageID, checkCondition } from "@common/packages"
import { useCurrentVariant } from "@utils/packages"
import { useConfigs, useCurrentProfile, useFeatures, useSettings } from "@utils/store"

export function usePackageOptions(packageId: PackageID): OptionInfo[] {
  const { profileOptions } = useConfigs()

  const variantInfo = useCurrentVariant(packageId)
  const profileInfo = useCurrentProfile()
  const features = useFeatures()
  const settings = useSettings()

  return (variantInfo.options ?? [])
    .map(option =>
      option.global
        ? {
            ...profileOptions.find(profileOption => profileOption.id === option.id),
            section: "",
            ...option,
          }
        : option,
    )
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
    )
}
