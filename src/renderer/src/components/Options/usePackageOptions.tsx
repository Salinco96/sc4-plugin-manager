import { getEnabledLots, isTogglableLot } from "@common/lots"
import { type OptionID, type OptionInfo, OptionType } from "@common/options"
import { type PackageID, checkCondition } from "@common/packages"
import { values } from "@salinco/nice-utils"
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
      ?.map(option =>
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
      ) ?? []

  const togglableLots = values(variantInfo.lots ?? {})
    .flatMap(values)
    .filter(isTogglableLot)

  if (togglableLots.length) {
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
