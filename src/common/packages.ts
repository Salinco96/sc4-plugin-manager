import {
  PackageCategory,
  PackageInfo,
  PackageStatus,
  ProfileInfo,
  VariantInfo,
  getCategory,
} from "@common/types"

export function getPackageStatus(
  packageInfo: PackageInfo,
  profileInfo?: ProfileInfo,
): PackageStatus | undefined {
  return profileInfo && packageInfo.status[profileInfo.id]
}

export function getVariantIssues(
  variantInfo: VariantInfo,
  packageStatus?: PackageStatus,
): string[] {
  return packageStatus?.issues[variantInfo.id] ?? []
}

export function isDependency(variantInfo: VariantInfo): boolean {
  return getCategory(variantInfo) === PackageCategory.DEPENDENCIES
}

export function isDeprecated(variantInfo: VariantInfo): boolean {
  return !!variantInfo.deprecated
}

export function isEnabled(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  return !!packageStatus?.enabled && packageStatus.variantId === variantInfo.id
}

export function isError(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  const issues = getVariantIssues(variantInfo, packageStatus)
  return isEnabled(variantInfo, packageStatus) && (!!issues.length || !variantInfo.installed)
}

export function isExperimental(variantInfo: VariantInfo): boolean {
  return !!variantInfo.experimental
}

export function isIncompatible(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  const issues = getVariantIssues(variantInfo, packageStatus)
  return !isEnabled(variantInfo, packageStatus) && !!issues.length
}

export function isMissing(variantInfo: VariantInfo, packageStatus?: PackageStatus): boolean {
  return isEnabled(variantInfo, packageStatus) && !variantInfo.installed
}

export function isOutdated(variantInfo: VariantInfo): boolean {
  return !!variantInfo.update
}
