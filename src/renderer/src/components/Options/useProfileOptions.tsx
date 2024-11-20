import type { OptionInfo } from "@common/options"
import { checkCondition } from "@common/packages"
import { useCurrentProfile, useFeatures, useSettings, useStore } from "@utils/store"

export function useProfileOptions(): OptionInfo[] {
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.profileOptions)
  const features = useFeatures()
  const settings = useSettings()

  return profileOptions.filter(option =>
    checkCondition(
      option.condition,
      undefined,
      undefined,
      profileInfo,
      profileOptions,
      features,
      settings,
    ),
  )
}
