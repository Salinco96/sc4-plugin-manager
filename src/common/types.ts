import { AssetData, AssetID } from "./assets"
import { CategoryID } from "./categories"
import { OptionInfo, OptionValue, Options, Requirements } from "./options"

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

export enum Issue {
  CONFLICTING_FEATURE = "conflicting-feature",
  INCOMPATIBLE_DEPENDENCIES = "incompatible-dependencies",
  INCOMPATIBLE_FEATURE = "incompatible-feature",
  INCOMPATIBLE_OPTION = "incompatible-option",
  MISSING_FEATURE = "missing-feature",
}

export interface PackageAsset extends AssetData {
  cleanitol?: string
  docs?: Array<string | PackageFile>
  exclude?: Array<string | PackageFile>
  include?: Array<string | PackageFile>
  id: AssetID
}

export interface PackageConfig {
  enabled?: boolean
  options?: Options
  variant?: string
  version?: string
}

export interface PackageData extends VariantData {
  disabled?: boolean
  name?: string
  variants?: {
    [variantId: string]: VariantData
  }
}

export interface PackageFile {
  as?: string
  condition?: Requirements
  path: string
  priority?: number
}

export interface PackageInfo {
  format?: ConfigFormat
  id: string
  local?: boolean
  name: string
  status: {
    [profileId: string]: PackageStatus | undefined
  }
  variants: {
    [variantId: string]: VariantInfo
  }
}

export type Features = Partial<Record<Feature, boolean>>

export interface PackageStatus {
  action?: "disabling" | "enabling"
  enabled?: boolean
  issues?: Partial<Record<string, VariantIssue[]>>
  options?: Options
  requiredBy?: string[]
  variantId: string
}

export interface PackageWarning {
  id?: "bulldoze"
  message?: string
  on?: "enable" | "disable"
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

export interface VariantData {
  assets?: PackageAsset[]
  authors?: string[]
  category?: string
  features?: Feature[]
  dependencies?: string[]
  deprecated?: boolean
  description?: string
  experimental?: boolean
  files?: PackageFile[]
  images?: string[]
  lots?: LotData[]
  name?: string
  optional?: string[]
  options?: OptionInfo[]
  release?: string
  readme?: string
  repository?: string
  requirements?: Requirements
  thumbnail?: string
  url?: string
  version?: string
  warnings?: PackageWarning[]
}

export interface VariantIssue {
  external?: boolean
  feature?: Feature
  option?: string
  id: Issue
  packages?: string[]
  value?: OptionValue
}

export interface BaseVariantInfo extends VariantData {
  authors: string[]
  categories: CategoryID[]
  id: string
  lots?: LotInfo[]
  name: string
  priority: number
  version: string
}

export interface VariantInfo extends BaseVariantInfo {
  action?: "installing" | "updating" | "removing"
  cleanitol?: string
  docs?: string
  installed?: boolean
  local?: boolean
  new?: boolean
  update?: BaseVariantInfo
}

export enum PackageState {
  DEPENDENCY = "dependency",
  DEPRECATED = "deprecated",
  DISABLED = "disabled",
  ENABLED = "enabled",
  ERROR = "error",
  EXPERIMENTAL = "experimental",
  INCOMPATIBLE = "incompatible",
  INSTALLED = "installed",
  LOCAL = "local",
  NEW = "new",
  OUTDATED = "outdated",
}

export interface ProfileData {
  features?: Features
  name?: string
  options?: Options
  packages?: Partial<Record<string, PackageConfig | boolean | string>>
}

export interface ProfileInfo extends ProfileData {
  description?: string
  features: Features
  format?: ConfigFormat
  id: string
  name: string
  options: Options
  packages: Partial<Record<string, PackageConfig>>
}

export interface Settings {
  currentProfile?: string
  format?: ConfigFormat
  install?: {
    patched?: boolean
    path?: string
    version?: string
  }
  useYaml?: boolean
}

export function isCompatible(info: PackageInfo, variantId: string, profile: ProfileInfo): boolean {
  return !info.status[profile.id]?.issues?.[variantId]?.length
}

export function getDefaultVariant(info: PackageInfo, profile?: ProfileInfo): VariantInfo {
  const variants = Object.values(info.variants)

  if (profile) {
    const compatibleVariant = variants.find(variant => isCompatible(info, variant.id, profile))
    if (compatibleVariant) {
      return compatibleVariant
    }
  }

  return variants[0]
}

export function getState(
  state: PackageState,
  packageInfo: PackageInfo,
  variantId: string,
  profileInfo?: ProfileInfo,
): boolean {
  const packageConfig = profileInfo?.packages[packageInfo.id]
  const packageStatus = profileInfo ? packageInfo.status[profileInfo.id] : undefined
  const variantInfo = packageInfo.variants[variantId]

  const enabled = !!packageStatus?.enabled
  const explicit = !!packageConfig?.enabled
  const incompatible = !!packageStatus?.issues?.[variantId]?.length

  switch (state) {
    case PackageState.DEPENDENCY:
      return enabled && !explicit

    case PackageState.DEPRECATED:
      return !!variantInfo.deprecated

    case PackageState.DISABLED:
      return !!profileInfo && !!variantInfo.installed && !enabled

    case PackageState.ENABLED:
      return enabled && explicit

    case PackageState.ERROR:
      return enabled && (incompatible || !variantInfo.installed)

    case PackageState.EXPERIMENTAL:
      return !!variantInfo.experimental

    case PackageState.INCOMPATIBLE:
      return incompatible && !enabled

    case PackageState.INSTALLED:
      return !!variantInfo.installed

    case PackageState.LOCAL:
      return !!variantInfo.local

    case PackageState.NEW:
      return !!variantInfo.new

    case PackageState.OUTDATED:
      return !!variantInfo.installed && !!variantInfo.update
  }
}
