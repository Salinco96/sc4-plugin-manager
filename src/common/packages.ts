import { type ID, entries, isArray, values } from "@salinco/nice-utils"

import type { AuthorID } from "./authors"
import { isEnabledLot, isSC4LotFile, isTogglableLot } from "./lots"
import {
  type OptionID,
  type OptionInfo,
  type Requirements,
  getOptionInfo,
  getOptionValue,
} from "./options"
import type { ProfileInfo } from "./profiles"
import type { Settings } from "./settings"
import type { Feature, Features, PackageInfo, PackageStatus } from "./types"
import { matchFile } from "./utils/glob"
import type { FileInfo } from "./variants"
import { Issue, type VariantInfo, type VariantIssue } from "./variants"

export const MIN_VERSION_OPTION_ID = "minVersion" as OptionID

export const MMPS_OPTION_ID = "mmps" as OptionID

/** Package ID */
export type PackageID = ID<string, PackageInfo>

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

  if (patterns && !patterns.some(pattern => pattern.test(file.path))) {
    return false
  }

  if (isSC4LotFile(file.path)) {
    // SC4Lot file should contain a single lot
    const lots = variantInfo?.lots?.[file.path]
    const lot = lots && values(lots)[0]
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

  // TODO: Refactor this
  const mmp = variantInfo?.mmps?.find(mmp => mmp.file && matchFile(mmp.file, file.path))
  if (mmp) {
    // Never include MMPs unless explicitly enabled
    if (!packageConfig?.enabled) {
      return false
    }

    // Check if MMP is enabled
    const option = getOptionInfo(MMPS_OPTION_ID, variantInfo.options, profileOptions)

    if (option) {
      const enabledMMPs = getOptionValue(option, {
        ...packageConfig.options,
        ...profileInfo?.options,
      }) as string[]

      if (!enabledMMPs.includes(mmp.id)) {
        return false
      }
    }

    // Check if MMP is supported
    const isSupported = checkCondition(
      mmp.requirements,
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

    if (requirement === MIN_VERSION_OPTION_ID) {
      const patchVersion = settings?.install?.version?.split(".")[2]
      if (!patchVersion) {
        return true
      }

      return Number(patchVersion) >= Number(requiredValue)
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
          settings,
        )
      }

      return false
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

export function isNew(variantInfo: VariantInfo): boolean {
  const now = new Date()
  now.setDate(now.getDate() - 15)
  return !!variantInfo.release && variantInfo.release > now.toISOString()
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
