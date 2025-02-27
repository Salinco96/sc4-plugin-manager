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
import { type PackageID, getVariantIssues } from "./packages"
import type { PropInfo } from "./props"
import type { Feature, PackageInfo, PackageStatus, PackageWarning, VariantState } from "./types"

/** Variant ID */
export type VariantID = ID<string, VariantInfo>

export type ModelID = `${GroupID}-${InstanceID}`
export type TextureID = InstanceID<{ __type: "texture" }>

export type VariantContentsInfo = {
  buildingFamilies?: FamilyInfo[]
  buildings?: BuildingInfo[]
  lots?: LotInfo[]
  mmps?: FloraInfo[]
  models?: { [path in string]?: ModelID[] }
  propFamilies?: FamilyInfo[]
  props?: PropInfo[]
  textures?: { [path in string]?: TextureID[] }
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

export interface EditableVariantInfo {
  authors: AuthorID[]
  categories: CategoryID[]
  credits?: { id?: AuthorID; text?: string }[]
  deprecated?: boolean | PackageID | VariantID
  description?: string
  experimental?: boolean
  images?: string[]
  name?: string
  repository?: string
  summary?: string
  support?: string
  thanks?: { id?: AuthorID; text?: string }[]
  thumbnail?: string
  url?: string
  version: string
}

export interface BaseVariantInfo extends VariantContentsInfo, EditableVariantInfo {
  assets?: VariantAssetInfo[]
  default?: boolean
  dependencies?: DependencyInfo[]
  disabled?: boolean
  files?: FileInfo[]
  id: VariantID
  lastGenerated?: Date
  lastModified?: Date
  logs?: string
  new?: boolean
  optional?: PackageID[]
  options?: OptionInfo[]
  priority: number
  readme?: string[]
  release?: Date
  requirements?: Requirements
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

export function getStateLabel(t: TFunction<Namespace>, state: VariantState): string {
  return t(state, { ns: "VariantState" })
}

export function getDefaultVariant(
  packageInfo: Readonly<PackageInfo>,
  packageStatus?: Readonly<PackageStatus>,
): VariantInfo {
  const variants = values(packageInfo.variants)
  const validVariants = variants.filter(variant => !getVariantIssues(variant, packageStatus).length)
  const selectableVariants = validVariants.length ? validVariants : variants

  return (
    selectableVariants.find(variant => variant.default) ??
    selectableVariants.find(variant => variant.id === "default" && !variant.deprecated) ??
    selectableVariants.find(variant => !variant.deprecated) ??
    selectableVariants[0]
  )
}
