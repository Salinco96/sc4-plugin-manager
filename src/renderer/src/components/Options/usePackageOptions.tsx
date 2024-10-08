import { OptionInfo } from "@common/options"
import { checkCondition } from "@common/packages"
import { useCurrentVariant } from "@utils/packages"
import { useCurrentProfile, useStore } from "@utils/store"

export function usePackageOptions(packageId: string): OptionInfo[] {
  const variantInfo = useCurrentVariant(packageId)

  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.globalOptions)
  const features = useStore(store => store.features)

  return (
    variantInfo.options
      ?.map(option =>
        option.global
          ? {
              ...profileOptions?.find(profileOption => profileOption.id === option.id),
              section: "",
              ...option,
            }
          : option,
      )
      ?.filter(option =>
        checkCondition(
          option.condition,
          packageId,
          variantInfo,
          profileInfo,
          profileOptions,
          features,
        ),
      ) ?? []
  )
}
