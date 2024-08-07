/** Supported configuration formats */
export enum ConfigFormat {
  JSON = ".json",
  YAML = ".yaml",
  YML = ".yml",
}

export interface AssetData {
  lastModified?: string
  sha256?: string
  size?: number
  uncompressed?: number
  url?: string
  version?: string
}

export interface AssetInfo extends AssetData {
  id: string
  url: string
}

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
  id: string
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
  category?: number
  condition?: Requirements
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

export enum OptionType {
  BOOLEAN = "boolean",
  NUMBER = "number",
  STRING = "string",
}

export interface OptionChoice<T> {
  description?: string
  label?: string
  value: T
}

export type OptionInfo<T extends OptionType = OptionType> = {
  condition?: Requirements
  default?: OptionValue<T> | OptionValue<T>[]
  description?: string
  filename?: string
  global?: boolean
  id: string
  label?: string
  multi?: boolean
  section?: string
  type: T
} & {
  [OptionType.BOOLEAN]: {
    default?: boolean
    display?: "checkbox" | "switch"
    type: OptionType.BOOLEAN
  }
  [OptionType.NUMBER]: {
    choices?: Array<number | OptionChoice<number>>
    default?: number
    display?: "checkbox" | "select"
    max?: number
    min?: number
    step?: number
    type: OptionType.NUMBER
  }
  [OptionType.STRING]: {
    choices: Array<string | OptionChoice<string>>
    display?: "checkbox" | "select"
    default?: string
    type: OptionType.STRING
  }
}[T]

export type OptionValue<T extends OptionType = OptionType> = {
  [OptionType.BOOLEAN]: boolean
  [OptionType.NUMBER]: number
  [OptionType.STRING]: string
}[T]

export type Requirements = Partial<Record<string, OptionValue>>

export type Options = Partial<Record<string, OptionValue | ReadonlyArray<OptionValue>>>

export type Features = Partial<Record<Feature, boolean>>

export interface PackageStatus {
  action?: "disabling" | "enabling"
  enabled: boolean
  issues: Partial<Record<string, VariantIssue[]>>
  options: Options
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
  images?: string[]
  name?: string
  optional?: string[]
  options?: OptionInfo[]
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
  features?: Features
  name?: string
  options?: Options
  packages?: Partial<Record<string, PackageConfig | boolean | string>>
}

export interface ProfileInfo extends ProfileData {
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
