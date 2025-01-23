import type { OptionInfo } from "@common/options"
import { checkCondition } from "@common/packages"
import { store } from "@stores/main"

export function useProfileOptions(): OptionInfo[] {
  const features = store.useFeatures()
  const profileInfo = store.useCurrentProfile()
  const profileOptions = store.useProfileOptions()
  const settings = store.useSettings()

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
