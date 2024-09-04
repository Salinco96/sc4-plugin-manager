import {
  Feature,
  PackageFile,
  PackageInfo,
  PackageStatus,
  ProfileInfo,
  VariantInfo,
  VariantIssue,
} from "@common/types"

import { OptionID, OptionInfo, Requirements, getOptionInfo, getOptionValue } from "./options"
import { ReadonlyDeep } from "./utils/objects"
import { isArray } from "./utils/types"

export function checkFile(
  file: PackageFile,
  packageId: string,
  variantInfo: VariantInfo,
  profileInfo?: ProfileInfo,
  profileOptions?: OptionInfo[],
  features?: Partial<Record<Feature, string[]>>,
): boolean {
  const packageConfig = profileInfo?.packages[packageId]

  const filename = file.path.split(/[\\/]/).at(-1)!

  const lot = variantInfo?.lots?.find(lot => lot.filename === filename)

  if (lot) {
    // Never include lots unless explicitly enabled
    if (!packageConfig?.enabled) {
      return false
    }

    // Check if lot is enabled
    const option = getOptionInfo("lots" as OptionID, variantInfo.options, profileOptions)

    if (option) {
      const enabledLots = getOptionValue(option, {
        ...packageConfig.options,
        ...profileInfo?.options,
      }) as string[]

      if (!enabledLots.includes(lot.id)) {
        return false
      }
    }

    // Check if lot is supported
    const isSupported = checkCondition(
      lot.requirements,
      packageId,
      variantInfo,
      profileInfo,
      profileOptions,
      features,
    )

    if (!isSupported) {
      return false
    }
  }

  return checkCondition(
    file.condition,
    packageId,
    variantInfo,
    profileInfo,
    profileOptions,
    features,
  )
}

export function checkCondition(
  condition?: Requirements,
  packageId?: string,
  variantInfo?: VariantInfo,
  profileInfo?: ProfileInfo,
  profileOptions?: OptionInfo[],
  features?: Partial<Record<Feature, string[]>>,
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

    const packageOption = variantInfo?.options?.find(option => option.id === requirement)
    if (packageOption && !packageOption.global) {
      const value = getOptionValue(packageOption, packageOptionValues)
      if (isArray(value) ? value.includes(requiredValue) : value === requiredValue) {
        const choice = packageOption.choices?.find(choice => choice.value === requiredValue)
        return checkCondition(
          choice?.condition,
          packageId,
          variantInfo,
          profileInfo,
          profileOptions,
          features,
        )
      }
    }

    const profileOption = profileOptions?.find(option => option.id === requirement)
    if (profileOption) {
      const value = getOptionValue(profileOption, profileOptionValues)
      if (isArray(value) ? value.includes(requiredValue) : value === requiredValue) {
        const choice = profileOption.choices?.find(choice => choice.value === requiredValue)
        return checkCondition(
          choice?.condition,
          undefined,
          undefined,
          profileInfo,
          profileOptions,
          features,
        )
      }
    }

    return requiredValue === !!features?.[requirement as Feature]?.length
  })
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
