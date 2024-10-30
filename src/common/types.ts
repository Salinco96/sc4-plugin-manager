import { CategoryID } from "./categories"
import { TGI } from "./dbpf"
import { ExemplarDataPatch } from "./exemplars"
import { Options, Requirements } from "./options"
import {
  PackageID,
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
import { ProfileID, ProfileInfo } from "./profiles"
import { keys } from "./utils/objects"
import { VariantData, VariantID, VariantInfo, VariantIssue } from "./variants"

/** Supported configuration formats */
export enum ConfigFormat {
  JSON = ".json",
  YAML = ".yaml",
  YML = ".yml",
}

export type Primitive = boolean | number | string | null | undefined

declare const ID: unique symbol

export type ID<T> = string & { [ID]: T }

export enum Feature {
  CAM = "cam",
  DARKNITE = "darknite",
  IRM = "irm",
  NAM = "nam",
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
  disabled?: boolean
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
  id?: "bulldoze"
  message?: string
  on?: "enable" | "disable" | "variantChange"
}

export interface LotData {
  /** Bulldoze cost */
  bulldoze?: number
  /** Category */
  category?: string
  /** Plop cost */
  cost?: number
  /** Whether lot is enabled by default (this defaults to true) */
  default?: boolean
  /** Number of jobs or residential capacity */
  demand?: {
    /** Medium-Wealth Offices */
    co$$?: number
    /** High-Wealth Offices */
    co$$$?: number
    /** Low-Wealth Services */
    cs$?: number
    /** Medium-Wealth Services */
    cs$$?: number
    /** High-Wealth Services */
    cs$$$?: number
    /** Dirty Industry */
    id?: number
    /** High-Tech Industry */
    iht?: number
    /** Manufacture */
    im?: number
    /** Agriculture */
    ir?: number
    /** Low-Wealth Residential */
    r$?: number
    /** Medium-Wealth Residential */
    r$$?: number
    /** High-Wealth Residential */
    r$$$?: number
  }
  /** Lot description */
  description?: string
  /** Full name of the file containing the lot (if missing the lot cannot be disabled) */
  filename?: string
  /** Flamability (number between 0 and 100) */
  flamability?: number
  /** Garbage produced */
  garbage?: number | `${number} over ${number} tiles`
  /** Lot ID (usually last part of TGI, but may be an arbitrary string) */
  id: string
  /** URL or relative path within ~docs */
  images?: string[]
  /** Monthly income */
  income?: number
  /** Lot name */
  label?: string
  /** Monthly maintenance cost */
  maintenance?: number
  /** Air pollution */
  pollution?: number | `${number} over ${number} tiles`
  /** Electricity consumed */
  power?: number
  /** Electricity produced */
  powerProduction?: number
  /** Requirements (e.g. CAM for stage 9+ growables) */
  requirements?: Requirements
  /** Lot size in AxB format (e.g. 2x3) */
  size?: `${number}x${number}`
  /** Growth stage */
  stage?: number
  /** Water consumed */
  water?: number
  /** Water pollution */
  waterPollution?: number | `${number} over ${number} tiles`
  /** Water produced */
  waterProduction?: number
  /** YIMBY effect (may be negative) */
  yimby?: number | `${number} over ${number} tiles`
}

export interface LotInfo extends LotData {
  categories?: CategoryID[]
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
