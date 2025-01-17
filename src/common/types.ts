import type { Options } from "./options"
import {
  type PackageID,
  isDependency,
  isDeprecated,
  isDisabled,
  isEnabled,
  isError,
  isExperimental,
  isIncluded,
  isIncompatible,
  isInstalled,
  isLocal,
  isOutdated,
  isPatched,
} from "./packages"
import type { ProfileID, ProfileInfo } from "./profiles"
import {
  type FileInfo,
  type VariantID,
  type VariantInfo,
  type VariantIssue,
  getDefaultVariant,
} from "./variants"

/** Supported configuration formats */
export enum ConfigFormat {
  JSON = ".json",
  YAML = ".yaml",
}

export enum Feature {
  CAM = "cam",
  DARKNITE = "darknite",
  DEVELOPER_CO$$ = "developer-co$$",
  DEVELOPER_CO$$$ = "developer-co$$$",
  DEVELOPER_CS$ = "developer-cs$",
  DEVELOPER_CS$$ = "developer-cs$$",
  DEVELOPER_CS$$$ = "developer-cs$$$",
  DEVELOPER_ID = "developer-id",
  DEVELOPER_IHT = "developer-iht",
  DEVELOPER_IM = "developer-im",
  DEVELOPER_IR = "developer-ir",
  DEVELOPER_R$ = "developer-r$",
  DEVELOPER_R$$ = "developer-r$$",
  DEVELOPER_R$$$ = "developer-r$$$",
  IRM = "irm",
  NAM = "nam",
  SIMULATOR_AURA = "simulator-aura",
  SIMULATOR_CRIME = "simulator-crime",
  SUBMENUS = "submenus",
}

export interface PackageConfig {
  enabled?: boolean
  options?: Options
  variant?: VariantID
  version?: string
}

export type PackageConfigs = {
  [packageId in PackageID]?: PackageConfig
}

export type Packages = {
  [packageId in PackageID]?: PackageInfo
}

export type Variants = {
  [variantId in VariantID]?: VariantInfo
}

export interface PackageInfo {
  features?: Feature[]
  format?: ConfigFormat
  id: PackageID
  local?: boolean
  name: string
  status: {
    [profileId in ProfileID]?: PackageStatus
  }
  variants: Variants
}

export const EXTERNAL = "<external>"

export type ExternalFeature = typeof EXTERNAL

export type ExternalFeatures = {
  [feature in Feature]?: boolean
}

export type Features = {
  [feature in Feature]?: Array<PackageID | ExternalFeature>
}

export interface PackageStatus {
  /** Current action relating to this package */
  action?: "disabling" | "enabling"
  /** Whether package is explicitly enabled */
  enabled?: boolean
  /** Which files are included (glob patterns, only as dependency, defaults to all) */
  files?: string[]
  /** Whether package is included (as dependency or explicitly) */
  included?: boolean
  /** Incompatibility issues for each variant */
  issues?: { [variantId in VariantID]?: VariantIssue[] }
  /** IDs of included packages that required this one as dependency */
  requiredBy?: PackageID[]
  /** Whether dependencies are included */
  transitive?: boolean
  /** Selected variant ID */
  variantId: VariantID
}

export interface PackageWarning {
  id?: string
  message?: string
  on?: "enable" | "disable" | "variant"
  title?: string
}

export enum VariantState {
  CURRENT = "current", // todo: this is not a *variant* state
  DEFAULT = "default",
  DEPENDENCY = "dependency",
  DEPRECATED = "deprecated",
  DISABLED = "disabled",
  ENABLED = "enabled",
  ERROR = "error",
  EXPERIMENTAL = "experimental",
  INCLUDED = "included",
  INCOMPATIBLE = "incompatible",
  INSTALLED = "installed",
  LOCAL = "local",
  NEW = "new",
  OUTDATED = "outdated",
  PATCHED = "patched",
}

export function getState(
  state: VariantState,
  packageInfo: PackageInfo,
  variantInfo: VariantInfo,
  profileInfo: ProfileInfo | undefined,
): boolean {
  const packageStatus = profileInfo && packageInfo.status[profileInfo.id]

  switch (state) {
    case VariantState.CURRENT:
      return variantInfo.id === packageStatus?.variantId

    case VariantState.DEFAULT:
      return variantInfo.id === getDefaultVariant(packageInfo, packageStatus).id

    case VariantState.DEPENDENCY:
      return isDependency(packageStatus)

    case VariantState.DEPRECATED:
      return isDeprecated(variantInfo)

    case VariantState.DISABLED:
      return isDisabled(variantInfo, packageStatus)

    case VariantState.ENABLED:
      return isEnabled(variantInfo, packageStatus)

    case VariantState.ERROR:
      return isError(variantInfo, packageStatus)

    case VariantState.EXPERIMENTAL:
      return isExperimental(variantInfo)

    case VariantState.INCLUDED:
      return isIncluded(variantInfo, packageStatus)

    case VariantState.INCOMPATIBLE:
      return isIncompatible(variantInfo, packageStatus)

    case VariantState.INSTALLED:
      return isInstalled(variantInfo)

    case VariantState.LOCAL:
      return isLocal(variantInfo)

    case VariantState.NEW:
      return !!variantInfo.new

    case VariantState.OUTDATED:
      return isOutdated(variantInfo)

    case VariantState.PATCHED:
      return isPatched(variantInfo)
  }
}

export function isOverride(file: FileInfo): boolean {
  return !!file.priority && file.priority >= 900
}
