import { CategoryID } from "./categories"

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
  sha256?: string
  size?: number
  url: string
  version: string
}

export interface PackageAsset {
  cleanitol?: string
  exclude?: PackageFile[]
  include?: PackageFile[]
  id: string
  path?: string
  sha256?: string
  size?: number
  url?: string
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
  as?: string
  category?: CategoryID
  condition?: PackageCondition
  path: string
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

export interface PackageOptions {
  [key: string]: boolean
}

export interface PackageStatus {
  enabled: boolean
  issues: {
    [variantId: string]: string[] | undefined
  }
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
  experimental?: boolean
  files?: PackageFile[]
  name?: string
  readme?: string
  requirements?: PackageCondition
  url?: string
  version?: string
}

export interface BaseVariantInfo extends VariantData {
  authors: string[]
  category: CategoryID
  id: string
  name: string
  version: string
}

export interface VariantInfo extends BaseVariantInfo {
  action?: "installing" | "updating" | "removing"
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
  externals?: {
    [groupId: string]: boolean | undefined
  }
}

export interface ProfileInfo {
  id: string
  format?: ConfigFormat
  name: string
  packages: {
    [packageId: string]: PackageConfig | undefined
  }
  externals: {
    [groupId: string]: boolean | undefined
  }
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

export function isCompatible(info: PackageInfo, variantId: string, profile: ProfileInfo): boolean {
  return !info.status[profile.id]?.issues[variantId]?.length
}

export function getDefaultVariantStrict(
  info: PackageInfo,
  profile: ProfileInfo,
): VariantInfo | undefined {
  const variants = Object.values(info.variants)
  const compatibleVariants = variants.filter(variant => isCompatible(info, variant.id, profile))
  if (compatibleVariants.length === 1) {
    return compatibleVariants[0]
  }

  const defaultVariant = info.variants[DEFAULT_VARIANT_ID]
  if (isCompatible(info, DEFAULT_VARIANT_ID, profile)) {
    return defaultVariant
  }
}

export function getDefaultVariant(info: PackageInfo, profile?: ProfileInfo): VariantInfo {
  const defaultVariant = info.variants[DEFAULT_VARIANT_ID]

  if (profile) {
    if (defaultVariant && isCompatible(info, DEFAULT_VARIANT_ID, profile)) {
      return defaultVariant
    }

    const variants = Object.values(info.variants)
    const compatibleVariant = variants.find(variant => isCompatible(info, variant.id, profile))
    if (compatibleVariant) {
      return compatibleVariant
    }
  }

  return defaultVariant ?? Object.values(info.variants)[0]
}

export function getState(
  state: PackageState,
  packageInfo: PackageInfo,
  variantId: string,
  profileInfo?: ProfileInfo,
): boolean {
  const packageStatus = profileInfo ? packageInfo.status[profileInfo.id] : undefined
  const variantInfo = packageInfo.variants[variantId]
  const issues = packageStatus?.issues[variantId]

  switch (state) {
    case PackageState.DEPENDENCY:
      return !!packageStatus?.enabled && !profileInfo?.packages[packageInfo.id]?.enabled

    case PackageState.DEPRECATED:
      return !!variantInfo?.deprecated

    case PackageState.DISABLED:
      return !!variantInfo?.installed && packageStatus?.enabled === false

    case PackageState.ENABLED:
      return !!packageStatus?.enabled

    case PackageState.ERROR:
      return !!packageStatus?.enabled && (!!issues?.length || !variantInfo.installed)

    case PackageState.EXPERIMENTAL:
      return !!variantInfo?.experimental

    case PackageState.INCOMPATIBLE:
      return packageStatus?.enabled === false && !!issues?.length

    case PackageState.INSTALLED:
      return !!variantInfo?.installed

    case PackageState.LOCAL:
      return !!variantInfo?.local

    case PackageState.OUTDATED:
      return !!variantInfo?.installed && !!variantInfo.update
  }
}
