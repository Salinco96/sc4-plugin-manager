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
}

export type Primitive = boolean | number | string | null | undefined

declare const IDType: unique symbol

export type ID<T> = string & { [IDType]: T }

export function ID<T>(id: string): ID<T> {
  return id as ID<T>
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
  id?: string
  message?: string
  on?: "enable" | "disable" | "variant"
  title?: string
}

export interface BuildingData {
  /** Bulldoze cost */
  bulldoze?: number
  /** Number of jobs or residential capacity */
  capacity?: {
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
  /** Category */
  category?: string
  /** Plop cost */
  cost?: number
  /** Zone density where this lot may grow - comma-separated: "low", "medium", "high" */
  density?: string
  /** Lot description */
  description?: string
  /** Path to the file containing the building exemplar */
  filename?: string
  /** Flamability (number between 0 and 100) */
  flamability?: number
  /** Garbage generated */
  garbage?: number
  /** Garbage radius in tiles */
  garbageRadius?: number
  /** Lot Instance ID */
  id: string
  /** Monthly income */
  income?: number
  /** Lot name */
  label?: string
  /** Landmark effect */
  landmark?: number
  /** Landmark effect radius in tiles */
  landmarkRadius?: number
  /** Monthly maintenance cost */
  maintenance?: number
  /** TGI of building model */
  model?: TGI
  /** Radiation generated */
  radiation?: number
  /** Radiation radius in tiles */
  radiationRadius?: number
  /** Air pollution generated */
  pollution?: number
  /** Air pollution radius in tiles */
  pollutionRadius?: number
  /** Electricity consumed */
  power?: number
  /** Electricity produced */
  powerProduction?: number
  /** Mayor rating effect */
  rating?: number
  /** Mayor rating effect radius in tiles */
  ratingRadius?: number
  /** Water consumed */
  water?: number
  /** Water pollution generated */
  waterPollution?: number
  /** Water pollution radius in tiles */
  waterPollutionRadius?: number
  /** Water produced */
  waterProduction?: number
  /** Building value */
  worth?: number
}

export interface LotData extends BuildingData {
  /** Building exemplar instance ID */
  building?: string
  /** Whether lot is enabled by default (this defaults to true) */
  default?: boolean
  /** Path to the file containing the lot exemplar */
  filename?: string
  /** URL or relative path within ~docs */
  images?: string[]
  /** Internal lot name */
  name?: string
  /** Instance IDs of all props used by this lot */
  props?: string[]
  /** Lot Instance ID to replace with this one (e.g. different ID for DN/MN) */
  replace?: string
  /** Whether this lot replaces a Maxis lot that may suffer from phantom slider bug */
  replaceMaxis?: boolean
  /** Requirements (e.g. CAM for stage 9+ growables) */
  requirements?: Requirements
  /** Lot size in AxB format (e.g. 2x3) */
  size?: `${number}x${number}`
  /** Growth stage */
  stage?: number
  /** Instance IDs of all textures used by this lot */
  textures?: string[]
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
