import { type ID, contains, containsAny, entries, isArray } from "@salinco/nice-utils"

import type { AuthorID } from "./authors"
import { isEnabledLot, isSC4LotFile, isTogglableLot } from "./lots"
import {
  type OptionInfo,
  type OptionValue,
  Requirement,
  type Requirements,
  getOptionValue,
} from "./options"
import type { ProfileInfo } from "./profiles"
import type { Settings } from "./settings"
import type { ToolInfo } from "./tools"
import type { Feature, Features, PackageInfo, PackageStatus } from "./types"
import type { FileInfo } from "./variants"
import { Issue, type VariantInfo, type VariantIssue } from "./variants"

/** Package ID */
export type PackageID = ID<string, PackageInfo>

export function checkValue(value: OptionValue, requiredValue: OptionValue): boolean {
  return isArray(value)
    ? isArray(requiredValue)
      ? containsAny(value, requiredValue)
      : contains(value, requiredValue)
    : isArray(requiredValue)
      ? contains(requiredValue, value)
      : requiredValue === value
}

export function checkFile(
  file: FileInfo,
  packageId: PackageID,
  variantInfo: VariantInfo,
  profileInfo: ProfileInfo | undefined,
  profileOptions: ReadonlyArray<OptionInfo>,
  features: Features,
  settings: Settings | undefined,
  patterns: RegExp[] | undefined,
  alwaysIncludeLots: boolean,
): boolean {
  const packageConfig = profileInfo?.packages[packageId]

  if (patterns && !packageConfig?.enabled && !patterns.some(pattern => pattern.test(file.path))) {
    return false
  }

  if (isSC4LotFile(file.path)) {
    // SC4Lot file should contain a single lot
    const lot = variantInfo?.lots?.find(lot => lot.file === file.path)
    if (lot && isTogglableLot(lot)) {
      // Do not include lots unless explicitly enabled
      if (!packageConfig?.enabled && !alwaysIncludeLots) {
        return false
      }

      // Do not include lots disabled via options
      if (!isEnabledLot(lot, packageConfig)) {
        return false
      }

      // Check if lot is supported
      const isSupported = checkCondition(
        lot.requirements,
        packageId,
        variantInfo,
        profileInfo,
        profileOptions,
        features,
        settings,
      )

      if (!isSupported) {
        return false
      }
    }
  }

  return checkCondition(
    file.condition,
    packageId,
    variantInfo,
    profileInfo,
    profileOptions,
    features,
    settings,
  )
}

export function checkCondition(
  condition: Requirements | undefined,
  packageId: PackageID | undefined,
  variantInfo: VariantInfo | undefined,
  profileInfo: ProfileInfo | undefined,
  profileOptions: ReadonlyArray<OptionInfo>,
  features: Features,
  settings: Settings | undefined,
): boolean {
  if (!condition) {
    return true
  }

  const packageConfig = packageId ? profileInfo?.packages[packageId] : undefined

  const profileOptionValues = profileInfo?.options ?? {}
  const packageOptionValues = { ...packageConfig?.options, ...profileOptionValues }

  return entries(condition).every(([requirement, requiredValue]) => {
    if (requiredValue === undefined) {
      return true
    }

    switch (requirement) {
      case Requirement.EXE_4GB_PATCH: {
        return !!settings?.install?.patched === !!requiredValue
      }

      case Requirement.MIN_VERSION: {
        const patchVersion = settings?.install?.version?.split(".")[2]
        return !patchVersion || Number(patchVersion) >= Number(requiredValue)
      }
    }

    const packageOption = variantInfo?.options?.find(option => option.id === requirement)
    if (packageOption && !packageOption.global) {
      const value = getOptionValue(packageOption, packageOptionValues)
      if (checkValue(value, requiredValue)) {
        const choice = packageOption.choices?.find(choice => choice.value === requiredValue)
        return checkCondition(
          choice?.condition,
          packageId,
          variantInfo,
          profileInfo,
          profileOptions,
          features,
          settings,
        )
      }

      return false
    }

    const profileOption = profileOptions?.find(option => option.id === requirement)
    if (profileOption) {
      const value = getOptionValue(profileOption, profileOptionValues)
      if (checkValue(value, requiredValue)) {
        const choice = profileOption.choices?.find(choice => choice.value === requiredValue)
        return checkCondition(
          choice?.condition,
          undefined,
          undefined,
          profileInfo,
          profileOptions,
          features,
          settings,
        )
      }

      return false
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

export function getVariantIssues(variantInfo: VariantInfo, status?: PackageStatus): VariantIssue[] {
  return status?.issues?.[variantInfo.id] ?? []
}

export function isConflict(
  issue: VariantIssue,
  variantInfo: VariantInfo,
  packageStatus?: PackageStatus,
): boolean {
  if (!isIncluded(variantInfo, packageStatus)) {
    return false
  }

  return packageStatus?.transitive || issue.id !== Issue.INCOMPATIBLE_DEPENDENCIES
}

export function isDependency(packageStatus?: PackageStatus): boolean {
  return !!packageStatus?.included && !packageStatus.enabled
}

export function isDeprecated(variantInfo: VariantInfo): boolean {
  return !!variantInfo.deprecated
}

export function isDisabled(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  return !!packageStatus && !packageStatus.enabled && !!variantInfo.installed
}

export function isEnabled(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  return !!packageStatus?.enabled && packageStatus.variantId === variantInfo.id
}

export function isError(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  return isInvalid(variantInfo, packageStatus) || isMissing(variantInfo, packageStatus)
}

export function isExperimental(variantInfo: VariantInfo): boolean {
  return !!variantInfo.experimental
}

export function isIncluded(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  return packageStatus?.variantId === variantInfo.id && !!packageStatus?.included
}

export function isIncompatible(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  if (isEnabled(variantInfo, packageStatus)) {
    return false
  }

  const issues = getVariantIssues(variantInfo, packageStatus)

  return !!issues?.length
}

export function isInstalled(variantInfo: VariantInfo): boolean {
  return !!variantInfo.installed
}

export function isInvalid(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  if (!packageStatus?.included) {
    return false
  }

  const issues = getVariantIssues(variantInfo, packageStatus)

  return packageStatus?.transitive !== false
    ? !!issues?.length
    : !!issues?.some(issue => issue.id !== Issue.INCOMPATIBLE_DEPENDENCIES)
}

export function isLocal(variantInfo: VariantInfo): boolean {
  return !!variantInfo.local
}

export function isMissing(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  return isIncluded(variantInfo, packageStatus) && !isInstalled(variantInfo)
}

export function isNew(variantInfo: ToolInfo | VariantInfo): boolean {
  const now = new Date()
  now.setDate(now.getDate() - 15)
  return !!variantInfo.release && variantInfo.release > now
}

export function isOutdated(variantInfo: VariantInfo): boolean {
  return !!variantInfo.installed && !!variantInfo.update
}

export function isPatched(variantInfo: VariantInfo): boolean {
  return !!variantInfo.files?.some(file => !!file.patches)
}

export function isRequired(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  return isIncluded(variantInfo, packageStatus) && !!packageStatus?.requiredBy?.length
}

export function getOwnerId(packageId: PackageID): AuthorID {
  return packageId.split("/")[0] as AuthorID
}
