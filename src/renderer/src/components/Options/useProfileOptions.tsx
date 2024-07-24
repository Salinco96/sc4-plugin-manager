import { checkCondition } from "@common/packages"
import { OptionInfo } from "@common/types"
import { useCurrentProfile, useStore } from "@utils/store"

export function useProfileOptions(): OptionInfo[] {
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.options)
  const features = useStore(store => store.features)

  return (
    profileOptions?.filter(option =>
      checkCondition(option.condition, undefined, undefined, profileInfo, profileOptions, features),
    ) ?? []
  )
}
