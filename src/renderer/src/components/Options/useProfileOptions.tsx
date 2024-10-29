import { OptionInfo } from "@common/options"
import { checkCondition } from "@common/packages"
import { useConfigs, useCurrentProfile, useFeatures, useSettings } from "@utils/store"

export function useProfileOptions(): OptionInfo[] {
  const { profileOptions } = useConfigs()

  const profileInfo = useCurrentProfile()
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
