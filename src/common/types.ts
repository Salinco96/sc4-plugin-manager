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
  DISABLED = "disabled",
  ENABLED = "enabled",
  ERROR = "error",
  OUTDATED = "outdated",
}

export interface CollectionInfo {
  id: string
  name: string
}

export interface ProfileInfo {
  id: string
  name: string
  packages: { [id: string]: { dependency?: boolean; variant?: string } }
}

export interface PackageInfo {
  assets?: { assetId: string }[]
  author: string
  authors: string[]
  category: number
  dependencies: string[]
  id: string
  installed?: string
  installing?: boolean
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

export function getState(info: PackageInfo, state: PackageState, profile?: ProfileInfo): boolean {
  switch (state) {
    case PackageState.DISABLED:
      return !!profile && !!info.installed && !profile.packages[info.id]

    case PackageState.ENABLED:
      return !!profile && !!info.installed && !!profile.packages[info.id]

    case PackageState.OUTDATED:
      return !!info.installed && !!info.version && info.installed !== info.version

    default:
      return false
  }
}
