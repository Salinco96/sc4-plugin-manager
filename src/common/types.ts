import { ProfileSettings } from "./profiles"

export interface AssetData {
  assetId: string
  lastModified: string
  url: string
  version: string
}

export interface PackageData {
  assets?: {
    assetId: string
    exclude?: string[]
    include?: string[]
  }[]
  dependencies?: string[]
  group: string
  info?: {
    author?: string
    conflicts?: string
    description?: string
    summary?: string
    website?: string
  }
  name: string
  subfolder: string
  variantDescriptions?: {
    [key: string]: {
      [value: string]: string
    }
  }
  variants?: {
    assets: {
      assetId: string
      exclude?: string[]
      include?: string[]
    }[]
    dependencies?: string[]
    variant: {
      [key: string]: string
    }
  }[]
  version: string
}

export interface PackageConfig {
  enabled?: boolean
  variant?: string
}

export interface PackageStatus {
  enabled?: boolean
  requiredBy?: string[]
  variant: string
}

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
  COMPATIBLE = "compatible",
  DEPENDENCY = "dependency",
  DISABLED = "disabled",
  ENABLED = "enabled",
  ERROR = "error",
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
  format?: string
  name: string
  packages: {
    [packageId in string]?: PackageConfig
  }
  settings: ProfileSettings
}

export interface PackageInfo {
  author: string
  category: number
  docs?: string
  format?: string
  id: string
  name: string
  status: PackageStatus
  variants: {
    [id in string]?: VariantInfo
  }
}

export interface VariantInfo {
  assets: { assetId: string; exclude?: string[]; include?: string[] }[]
  compatible: boolean
  dependencies: string[]
  files?: { category?: number; path: string }[]
  id: string
  installed?: string
  installing?: boolean
  local?: boolean
  name: string
  version: string
}

export interface AssetInfo {
  id: string
  lastModified: Date
  url: string
  version: string
}

export interface Settings {
  currentProfile?: string
  format?: string
  useYaml?: boolean
}

export function getCategory(info: PackageInfo): PackageCategory {
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

export function getDefaultVariant(info: PackageInfo): string {
  if (info.variants.default?.compatible) {
    return "default"
  } else {
    const variants = Object.values(info.variants)
    return (variants.find(variant => variant?.compatible) ?? variants[0])?.id ?? "default"
  }
}

export function getState(info: PackageInfo, state: PackageState, profile?: ProfileInfo): boolean {
  const config = profile?.packages?.[info.id]
  const variant = info.variants[info.status.variant]

  switch (state) {
    case PackageState.COMPATIBLE:
      return !!variant?.compatible

    case PackageState.DEPENDENCY:
      return !!profile && !!info.status.enabled && !config?.enabled

    case PackageState.DISABLED:
      return !!profile && !!variant?.installed && !info.status.enabled

    case PackageState.ENABLED:
      return !!profile && !!info.status.enabled

    case PackageState.ERROR:
      return !!profile && !!info.status.enabled && (!variant?.installed || !variant?.compatible) // TODO: More errors

    case PackageState.INSTALLED:
      return !!variant?.installed

    case PackageState.LOCAL:
      return !!variant?.local

    case PackageState.OUTDATED:
      return !!variant?.installed && variant.installed !== variant.version
  }
}
