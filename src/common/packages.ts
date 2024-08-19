import {
  Feature,
  OptionInfo,
  OptionType,
  OptionValue,
  Options,
  // PackageConfig,
  PackageInfo,
  PackageStatus,
  ProfileInfo,
  Requirements,
  VariantInfo,
  VariantIssue,
} from "@common/types"

import { ReadonlyDeep } from "./utils/objects"
import { isArray, isNumber, isString } from "./utils/types"

export function checkCondition(
  condition?: ReadonlyDeep<Requirements>,
  packageId?: string,
  variantInfo?: ReadonlyDeep<VariantInfo>,
  profileInfo?: ReadonlyDeep<ProfileInfo>,
  profileOptions?: ReadonlyDeep<OptionInfo[]>,
  features?: ReadonlyDeep<Partial<Record<Feature, string[]>>>,
): boolean {
  if (!condition) {
    return true
  }

  const packageConfig = packageId ? profileInfo?.packages[packageId] : undefined

  const profileOptionValues = profileInfo?.options ?? {}
  const packageOptionValues = { ...packageConfig?.options, ...profileOptionValues }

  return Object.entries(condition).every(([requirement, requiredValue]) => {
    if (requiredValue === undefined) {
      return true
    }

    // Never include lots unless explicitly enabled
    if (requirement === "lots" && !packageConfig?.enabled) {
      return false
    }

    const packageOption = variantInfo?.options?.find(option => option.id === requirement)
    if (packageOption && !packageOption.global) {
      const value = getOptionValue(packageOption, packageOptionValues)
      return isArray(value) ? value.includes(requiredValue) : value === requiredValue
    }

    const profileOption = profileOptions?.find(option => option.id === requirement)
    if (profileOption) {
      const value = getOptionValue(profileOption, profileOptionValues)
      return isArray(value) ? value.includes(requiredValue) : value === requiredValue
    }

    return requiredValue === !!features?.[requirement as Feature]?.length
  })
}

export function getOptionDefaultValue(
  option: ReadonlyDeep<OptionInfo>,
): OptionValue | ReadonlyArray<OptionValue> {
  if (option.default !== undefined) {
    if (option.multi && "choices" in option && option.default === "all") {
      return option.choices!.map(choice => (typeof choice === "object" ? choice.value : choice))
    }

    return option.default
  }

  if (option.multi) {
    return []
  }

  switch (option.type) {
    case OptionType.BOOLEAN:
      return false

    case OptionType.NUMBER: {
      const firstChoice = option.choices?.at(0)
      if (firstChoice !== undefined) {
        return isNumber(firstChoice) ? firstChoice : firstChoice.value
      }

      return option.min ?? 0
    }

    case OptionType.STRING: {
      const firstChoice = option.choices.at(0)
      if (firstChoice !== undefined) {
        return isString(firstChoice) ? firstChoice : firstChoice.value
      }

      return "default"
    }
  }
}

export function getOptionValue(
  option: ReadonlyDeep<OptionInfo>,
  options?: ReadonlyDeep<Options>,
): OptionValue | ReadonlyArray<OptionValue> {
  return options?.[option.id] ?? getOptionDefaultValue(option)
}

export function getPackageStatus(
  packageInfo: PackageInfo,
  profileInfo?: ProfileInfo,
): PackageStatus | undefined {
  return profileInfo && packageInfo.status[profileInfo.id]
}

export function getVariantIssues(variantId: string, packageStatus?: PackageStatus): VariantIssue[] {
  return packageStatus?.issues?.[variantId] ?? []
}

export function hasIssues(variantId: string, packageStatus?: ReadonlyDeep<PackageStatus>): boolean {
  return !!packageStatus?.issues?.[variantId]?.length
}

export function isDeprecated(variantInfo: VariantInfo): boolean {
  return !!variantInfo.deprecated
}

export function isEnabled(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  return !!packageStatus?.enabled && packageStatus.variantId === variantInfo.id
}

export function isError(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  const issues = hasIssues(variantInfo.id, packageStatus)
  return isEnabled(variantInfo, packageStatus) && (!!issues || !variantInfo.installed)
}

export function isExperimental(variantInfo: VariantInfo): boolean {
  return !!variantInfo.experimental
}

export function isIncompatible(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  const issues = hasIssues(variantInfo.id, packageStatus)
  return !isEnabled(variantInfo, packageStatus) && !!issues
}

export function isMissing(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  return isEnabled(variantInfo, packageStatus) && !variantInfo.installed
}

export function isNew(variantInfo: VariantInfo): boolean {
  const now = new Date()
  now.setDate(now.getDate() - 15)
  return !!variantInfo.release && variantInfo.release > now.toISOString()
}

export function isOutdated(variantInfo: VariantInfo): boolean {
  return !!variantInfo.update
}
