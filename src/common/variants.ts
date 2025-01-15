import { type ID, values } from "@salinco/nice-utils"
import type { Namespace, TFunction } from "i18next"

import type { AssetID } from "./assets"
import type { AuthorID } from "./authors"
import type { BuildingInfo } from "./buildings"
import type { CategoryID } from "./categories"
import type { GroupID, InstanceID, TGI } from "./dbpf"
import type { ExemplarDataPatch } from "./exemplars"
import type { FamilyInfo } from "./families"
import type { LotInfo } from "./lots"
import type { FloraInfo } from "./mmps"
import type { OptionID, OptionInfo, OptionValue, Requirements } from "./options"
import { type PackageID, isIncompatible } from "./packages"
import type { ProfileInfo } from "./profiles"
import type { PropInfo } from "./props"
import type { Feature, PackageInfo, PackageWarning, VariantState } from "./types"

/** Variant ID */
export type VariantID = ID<string, VariantInfo>

export type ModelID = `${GroupID}-${InstanceID}`
export type TextureID = InstanceID<{ __type: "texture" }>

export interface ContentsInfo {
  buildingFamilies?: FamilyInfo[]
  buildings?: BuildingInfo[]
  lots?: LotInfo[]
  mmps?: FloraInfo[]
  models?: {
    [path in string]?: ModelID[]
  }
  propFamilies?: FamilyInfo[]
  props?: PropInfo[]
  textures?: {
    [path in string]?: TextureID[]
  }
}

export interface FileInfo {
  as?: string
  condition?: Requirements
  patches?: {
    [entryId in TGI]?: ExemplarDataPatch
  }
  path: string
  priority?: number
}

export interface BaseVariantInfo extends ContentsInfo {
  assets?: VariantAssetInfo[]
  authors: AuthorID[]
  categories: CategoryID[]
  credits?: { id?: AuthorID; text?: string }[]
  default?: boolean
  dependencies?: DependencyInfo[]
  deprecated?: boolean | PackageID | VariantID
  description?: string
  disabled?: boolean
  experimental?: boolean
  files?: FileInfo[]
  id: VariantID
  images?: string[]
  lastGenerated?: Date
  lastModified?: Date
  logs?: string
  name?: string
  new?: boolean
  optional?: PackageID[]
  options?: OptionInfo[]
  priority: number
  readme?: string[]
  release?: Date
  repository?: string
  requirements?: Requirements
  summary?: string
  support?: string
  thanks?: { id?: AuthorID; text?: string }[]
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
  MISSING_4GB_PATCH = "missing-4gb-patch",
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

export interface VariantAssetInfo {
  cleanitol?: string[]
  docs?: FileInfo[]
  exclude?: string[]
  include?: FileInfo[]
  id: AssetID
}

export interface DependencyInfo {
  condition?: Requirements
  id: PackageID
  include?: string[]
  transitive: boolean
}

export function getStateLabel(
  t: TFunction<Namespace>,
  state: VariantState | "default" | "selected",
): string {
  return t(state, { ns: "VariantState" })
}
export function getDefaultVariant(
  packageInfo: Readonly<PackageInfo>,
  profileInfo: Readonly<ProfileInfo> | undefined,
): VariantInfo {
  const packageStatus = profileInfo && packageInfo.status[profileInfo.id]

  const allVariants = values(packageInfo.variants)
  const compatibleVariants = allVariants.filter(variant => !isIncompatible(variant, packageStatus))
  const selectableVariants = compatibleVariants.length ? compatibleVariants : allVariants

  return (
    selectableVariants.find(variant => variant.default) ??
    selectableVariants.find(variant => variant.id === "default" && !variant.deprecated) ??
    selectableVariants.find(variant => !variant.deprecated) ??
    selectableVariants[0]
  )
}
