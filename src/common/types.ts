/** Supported configuration formats */
export enum ConfigFormat {
  JSON = ".json",
  YAML = ".yaml",
  YML = ".yml",
}

export interface AssetData {
  sha256?: string
  size?: number
  url?: string
  version?: number | string
}

export interface AssetInfo extends AssetData {
  id: string
  lastModified?: Date
  url: string
  version?: string
}

export enum Feature {
  CAM = "cam",
  DARKNITE = "darknite",
  IRM = "irm",
  NAM = "nam",
  RHD = "rhd",
}

export enum Issue {
  CONFLICTING_FEATURE = "conflicting-feature",
  INCOMPATIBLE_DEPENDENCIES = "incompatible-dependencies",
  INCOMPATIBLE_FEATURE = "incompatible-feature",
  MISSING_FEATURE = "missing-feature",
}

export interface PackageAsset extends AssetData {
  cleanitol?: string
  docs?: Array<string | PackageFile>
  exclude?: Array<string | PackageFile>
  include?: Array<string | PackageFile>
  id: string
}

export interface PackageConfig {
  enabled?: boolean
  options?: PackageOptions
  variant?: string
  version?: string
}

export interface PackageData extends VariantData {
  name?: string
  variants?: {
    [variantId: string]: VariantData
  }
}

export interface PackageFile {
  as?: string
  category?: number
  condition?: {
    [feature in Feature]?: boolean
  }
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
  action?: "disabling" | "enabling"
  enabled: boolean
  issues: {
    [variantId in string]?: VariantIssue[]
  }
  options: PackageOptions
  requiredBy: string[]
  variantId: string
}

export interface PackageWarning {
  id?: "bulldoze"
  message?: string
  on?: "enable" | "disable"
}

export interface ToolInfo {
  assetId: string
  exe: string
}

export interface VariantData {
  assets?: PackageAsset[]
  authors?: string[]
  category?: number
  features?: Feature[]
  dependencies?: string[]
  deprecated?: boolean
  description?: string
  experimental?: boolean
  files?: PackageFile[]
  name?: string
  optional?: string[]
  readme?: string
  repository?: string
  requirements?: {
    [feature in Feature]?: boolean
  }
  thumbnail?: string
  url?: string
  version?: string
  warnings?: PackageWarning[]
}

export interface VariantIssue {
  external?: boolean
  feature?: Feature
  id: Issue
  packages?: string[]
}

export interface BaseVariantInfo extends VariantData {
  authors: string[]
  category: number
  id: string
  name: string
  version: string
}

export interface VariantInfo extends BaseVariantInfo {
  action?: "installing" | "updating" | "removing"
  cleanitol?: string
  docs?: string
  installed?: boolean
  local?: boolean
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
  OUTDATED = "outdated",
}

export interface ProfileData {
  name?: string
  packages?: {
    [packageId: string]: boolean | string | PackageConfig | undefined
  }
  externals?: {
    [feature in Feature]?: boolean
  }
}

export interface ProfileInfo {
  features: {
    [feature in Feature]?: boolean
  }
  format?: ConfigFormat
  id: string
  name: string
  packages: {
    [packageId: string]: PackageConfig | undefined
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

export function isCompatible(info: PackageInfo, variantId: string, profile: ProfileInfo): boolean {
  return !info.status[profile.id]?.issues[variantId]?.length
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
  const packageStatus = profileInfo ? packageInfo.status[profileInfo.id] : undefined
  const variantInfo = packageInfo.variants[variantId]
  const issues = packageStatus?.issues[variantId]

  switch (state) {
    case PackageState.DEPENDENCY:
      return !!packageStatus?.enabled && !profileInfo?.packages[packageInfo.id]?.enabled

    case PackageState.DEPRECATED:
      return !!variantInfo?.deprecated

    case PackageState.DISABLED:
      return !!variantInfo?.installed && !!packageStatus && !packageStatus.enabled

    case PackageState.ENABLED:
      return !!packageStatus?.enabled

    case PackageState.ERROR:
      return !!packageStatus?.enabled && (!!issues?.length || !variantInfo.installed)

    case PackageState.EXPERIMENTAL:
      return !!variantInfo?.experimental

    case PackageState.INCOMPATIBLE:
      return !!packageStatus && !packageStatus.enabled && !!issues?.length

    case PackageState.INSTALLED:
      return !!variantInfo?.installed

    case PackageState.LOCAL:
      return !!variantInfo?.local

    case PackageState.OUTDATED:
      return !!variantInfo?.installed && !!variantInfo.update
  }
}
