import type { ID } from "@salinco/nice-utils"
import type { Namespace, TFunction } from "i18next"

import type { AssetData, AssetID } from "./assets"
import type { AuthorID } from "./authors"
import type { CategoryID } from "./categories"
import type { OptionData, OptionID, OptionInfo, OptionValue, Requirements } from "./options"
import type { PackageID } from "./packages"
import type {
  Feature,
  LotData,
  LotInfo,
  MMPData,
  MMPInfo,
  PackageFile,
  PackageWarning,
  VariantState,
} from "./types"

/** Variant ID */
export type VariantID = ID<string, VariantInfo>

export interface VariantData {
  assets?: Array<AssetID | VariantAssetData>
  authors?: AuthorID[]
  category?: string
  dependencies?: Array<PackageID | DependencyInfo>
  deprecated?: boolean | PackageID
  description?: string
  disabled?: boolean
  experimental?: boolean
  files?: PackageFile[]
  images?: string[]
  lastModified?: Date
  logs?: string
  lots?: LotData[]
  mmps?: MMPData[]
  name?: string
  optional?: PackageID[]
  options?: OptionData[]
  release?: Date
  readme?: string
  repository?: string
  requirements?: Requirements
  summary?: string
  support?: string
  thumbnail?: string
  url?: string
  version?: string
  warnings?: PackageWarning[]
}

export interface BaseVariantInfo {
  assets?: VariantAssetInfo[]
  authors: AuthorID[]
  categories: CategoryID[]
  dependencies?: DependencyInfo[]
  deprecated?: boolean | PackageID
  description?: string
  experimental?: boolean
  files?: PackageFile[]
  id: VariantID
  images?: string[]
  lastModified?: string
  logs?: string
  lots?: LotInfo[]
  mmps?: MMPInfo[]
  name: string
  new?: boolean
  optional?: PackageID[]
  options?: OptionInfo[]
  priority: number
  release?: string
  readme?: string
  repository?: string
  requirements?: Requirements
  summary?: string
  support?: string
  thumbnail?: string
  url?: string
  version: string
  warnings?: PackageWarning[]
}

export interface VariantInfo extends BaseVariantInfo {
  action?: "installing" | "updating" | "removing"
  docs?: string
  installed?: boolean
  local?: boolean
  update?: BaseVariantInfo
}

export enum Issue {
  CONFLICTING_FEATURE = "conflicting-feature",
  INCOMPATIBLE_DEPENDENCIES = "incompatible-dependencies",
  INCOMPATIBLE_FEATURE = "incompatible-feature",
  INCOMPATIBLE_OPTION = "incompatible-option",
  INCOMPATIBLE_VERSION = "incompatible-version",
  MISSING_FEATURE = "missing-feature",
}

export interface VariantIssue {
  external?: boolean
  feature?: Feature
  option?: OptionID
  id: Issue
  minVersion?: string
  packages?: PackageID[]
  value?: OptionValue
}

export interface VariantAssetData extends AssetData {
  cleanitol?: string[]
  docs?: Array<string | PackageFile>
  exclude?: string[]
  include?: Array<string | PackageFile>
  id: AssetID
}

export interface VariantAssetInfo extends VariantAssetData {
  docs?: PackageFile[]
  include?: PackageFile[]
}

export interface DependencyData {
  id: PackageID
  include?: string[]
  transitive?: boolean
}

export interface DependencyInfo extends DependencyData {
  transitive: boolean
}

export function getStateLabel(
  t: TFunction<Namespace>,
  state: VariantState | "default" | "selected",
): string {
  return t(state, { ns: "VariantState" })
}
