import { CategoryID } from "./categories"
import { ProfileSettings } from "./profiles"

export const DEFAULT_VARIANT_ID = "default"

/** Supported configuration formats */
export enum ConfigFormat {
  JSON = ".json",
  YAML = ".yaml",
  YML = ".yml",
}

export interface AssetInfo {
  id: string
  lastModified?: Date
  url: string
  version: string
}

export interface PackageAsset {
  exclude?: PackageFile[]
  include?: PackageFile[]
  id: string
}

export interface PackageCondition {
  [key: string]: boolean
}

export interface PackageConfig {
  enabled?: boolean
  options?: PackageOptions
  variant?: string
}

export interface PackageData extends VariantData {
  name?: string
  variants?: {
    [variantId: string]: VariantData
  }
}

export interface PackageFile {
  category?: CategoryID
  condition?: PackageCondition
  path: string
}

export interface PackageInfo {
  format?: ConfigFormat
  id: string
  local?: boolean
  name: string
  status: PackageStatus
  variants: {
    [variantId: string]: VariantInfo
  }
}

export interface PackageOptions {
  [key: string]: boolean
}

export interface PackageStatus {
  enabled: boolean
  options: PackageOptions
  requiredBy: string[]
  variantId: string
}

export interface VariantData {
  assets?: PackageAsset[]
  authors?: string[]
  category?: number
  conflictGroups?: string[]
  dependencies?: string[]
  deprecated?: boolean
  description?: string
  docs?: {
    path?: string
  }
  experimental?: boolean
  files?: PackageFile[]
  name?: string
  requirements?: PackageCondition
  url?: string
  version?: string
}

export interface BaseVariantInfo extends VariantData {
  authors: string[]
  category: CategoryID
  id: string
  incompatible?: string[]
  issues?: string[]
  name: string
  version: string
}

export interface VariantInfo extends BaseVariantInfo {
  action?: "installing" | "updating"
  installed?: boolean
  local?: boolean
  update?: BaseVariantInfo
}

// OLD:

export enum PackageCategory {
  MODS = "mods",
  RESIDENTIAL = "residential",
  COMMERCIAL = "commercial",
  INDUSTRIAL = "industrial",
  ENERGY = "energy",
  CIVICS = "civics",
  LANDMARKS = "landmarks",
  PARKS = "parks",
  DEPENDENCIES = "dependencies",
  TRANSPORT = "transport",
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
  OUTDATED = "outdated",
}

export interface ProfileData {
  name?: string
  packages?: {
    [id in string]?: boolean | string | PackageConfig
  }
}

export interface ProfileInfo {
  id: string
  format?: ConfigFormat
  name: string
  packages: {
    [packageId in string]?: PackageConfig
  }
  settings: ProfileSettings
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

/** @deprecated */
export function getCategory(info: VariantInfo): PackageCategory {
  if (info.category < 100) {
    return PackageCategory.MODS
  }

  if (info.category < 200) {
    return PackageCategory.DEPENDENCIES
  }

  if (info.category < 300) {
    return PackageCategory.RESIDENTIAL
  }

  if (info.category === 360) {
    return PackageCategory.LANDMARKS
  }

  if (info.category < 400) {
    return PackageCategory.COMMERCIAL
  }

  if (info.category < 500) {
    return PackageCategory.INDUSTRIAL
  }

  if (info.category < 600) {
    return PackageCategory.ENERGY
  }

  if (info.category === 660) {
    return PackageCategory.PARKS
  }

  if (info.category < 700) {
    return PackageCategory.CIVICS
  }

  if (info.category < 800) {
    return PackageCategory.TRANSPORT
  }

  return PackageCategory.MODS
}

export function getDefaultVariant(info: PackageInfo): VariantInfo {
  const defaultVariant = info.variants[DEFAULT_VARIANT_ID]
  if (defaultVariant && !defaultVariant.incompatible) {
    return defaultVariant
  }

  const variants = Object.values(info.variants)
  const firstCompatibleVariant = variants.find(variant => !variant.incompatible)
  if (firstCompatibleVariant) {
    return firstCompatibleVariant
  }

  return defaultVariant ?? variants[0]
}

export function getState(info: PackageInfo, state: PackageState, profile?: ProfileInfo): boolean {
  const variant = info.variants[info.status.variantId]

  switch (state) {
    case PackageState.DEPENDENCY:
      return !!profile && !!info.status.enabled && !profile.packages[info.id]?.enabled

    case PackageState.DEPRECATED:
      return !!variant?.deprecated

    case PackageState.DISABLED:
      return !!profile && !!variant?.installed && !info.status.enabled

    case PackageState.ENABLED:
      return !!profile && !!info.status.enabled

    case PackageState.ERROR:
      return !!variant?.issues?.length

    case PackageState.EXPERIMENTAL:
      return !!variant?.experimental

    case PackageState.INCOMPATIBLE:
      return !!variant?.incompatible?.length

    case PackageState.INSTALLED:
      return !!variant?.installed

    case PackageState.LOCAL:
      return !!variant?.local

    case PackageState.OUTDATED:
      return !!variant?.installed && !!variant.update
  }
}
