import { getEnabledLots, isTogglableLot } from "@common/lots"
import { type OptionID, type OptionInfo, OptionType } from "@common/options"
import { type PackageID, checkCondition } from "@common/packages"
import { useCurrentVariant } from "@utils/packages"
import { useCurrentProfile, useFeatures, useSettings, useStore } from "@utils/store"

export function usePackageOptions(packageId: PackageID): OptionInfo[] {
  const variantInfo = useCurrentVariant(packageId)
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.profileOptions)
  const features = useFeatures()
  const settings = useSettings()

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

  const togglableLots = variantInfo.lots?.filter(isTogglableLot)

  if (togglableLots?.length) {
    options.push({
      choices: togglableLots.map(lot => ({
        condition: lot.requirements,
        label: lot.name ?? lot.id,
        value: lot.id,
      })),
      default: getEnabledLots(togglableLots),
      display: "checkbox",
      id: "lots" as OptionID,
      multi: true,
      section: "Lots", // TODO: i18n?
      type: OptionType.NUMBER,
    })
  }

  return options
}
