import { keys } from "@salinco/nice-utils"

import type { CategoryID } from "./categories"
import type { TGI } from "./dbpf"
import type { ExemplarDataPatch } from "./exemplars"
import type { Options, Requirements } from "./options"
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
import type { VariantData, VariantID, VariantInfo, VariantIssue } from "./variants"

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

export interface PackageData extends VariantData {
  features?: Feature[]
  name?: string
  variants?: {
    [variantId in VariantID]?: VariantData
  }
}

export interface PackageFile {
  as?: string
  condition?: Requirements
  patches?: {
    [entryId in TGI]?: ExemplarDataPatch
  }
  path: string
  priority?: number
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

export interface MMPData {
  /** Category */
  category?: string
  /** Whether MMP is enabled by default (this defaults to true) */
  default?: boolean
  /** MMP description */
  description?: string
  /** Full name of the file containing the MMP (if missing the MMP cannot be disabled) */
  filename?: string
  /** MMP ID (usually last part of TGI, but may be an arbitrary string) */
  id: string
  /** URL or relative path within ~docs */
  images?: string[]
  /** MMP name */
  label?: string
  /** Requirements */
  requirements?: Requirements
}

export interface MMPInfo extends MMPData {
  categories?: CategoryID[]
}

export enum VariantState {
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
  SELECTED = "selected",
}

export function getState(
  state: VariantState,
  packageInfo: PackageInfo,
  variantInfo: VariantInfo,
  profileInfo?: ProfileInfo,
): boolean {
  const packageStatus = profileInfo ? packageInfo.status[profileInfo.id] : undefined

  switch (state) {
    case VariantState.DEFAULT:
      return variantInfo.id === keys(packageInfo.variants)[0] // TODO

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

    case VariantState.SELECTED:
      return variantInfo.id === packageStatus?.variantId
  }
}

export function isOverride(file: PackageFile): boolean {
  return !!file.priority && file.priority >= 900
}
