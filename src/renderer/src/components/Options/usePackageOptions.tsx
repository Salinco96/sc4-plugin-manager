import { checkCondition } from "@common/packages"
import { OptionInfo } from "@common/types"
import { useCurrentVariant } from "@utils/packages"
import { useCurrentProfile, useStore } from "@utils/store"

export function usePackageOptions(packageId: string): OptionInfo[] {
  const variantInfo = useCurrentVariant(packageId)

  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.options)
  const features = useStore(store => store.features)

  return (
    variantInfo.options
      ?.filter(option =>
        checkCondition(
          option.condition,
          packageId,
          variantInfo,
          profileInfo,
          profileOptions,
          features,
        ),
      )
      .map(option =>
        option.global
          ? ({
              ...profileOptions?.find(profileOption => profileOption.id === option.id),
              section: "",
              ...option,
            } as OptionInfo)
          : option,
      ) ?? []
  )
}
