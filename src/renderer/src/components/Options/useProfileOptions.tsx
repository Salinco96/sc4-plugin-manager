import { OptionInfo } from "@common/options"
import { checkCondition } from "@common/packages"
import { useCurrentProfile, useStore } from "@utils/store"

export function useProfileOptions(): OptionInfo[] {
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.globalOptions)
  const features = useStore(store => store.features)

  return (
    profileOptions?.filter(option =>
      checkCondition(option.condition, undefined, undefined, profileInfo, profileOptions, features),
    ) ?? []
  )
}
