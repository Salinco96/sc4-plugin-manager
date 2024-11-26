import { type ID, toHex } from "@salinco/nice-utils"
import type { Namespace, TFunction } from "i18next"

import type { AssetData, AssetID } from "./assets"
import type { AuthorID } from "./authors"
import type { CategoryID } from "./categories"
import type { OptionData, OptionID, OptionInfo, OptionValue, Requirements } from "./options"
import type { PackageID } from "./packages"
import type {
  BuildingData,
  BuildingInfo,
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

export enum Menu {
  Flora = 0x4a22ea06,
  Residential = 0x29920899,
  Commercial = 0xa998af42,
  Industrial = 0xc998af00,
  Roads = 0x6999bf56,
  Highway = 0x00000031,
  Rail = 0x00000029,
  MiscTransit = 0x299237bf,
  Airports = 0xe99234b3,
  WaterTransit = 0xa99234a6,
  Power = 0x00000035,
  Water = 0x00000039,
  Garbage = 0x00000040,
  Police = 0x00000037,
  Fire = 0x00000038,
  Education = 0x00000042,
  Health = 0x89dd5405,
  Landmarks = 0x09930709,
  Rewards = 0x00000034,
  Parks = 0x00000003,
}

export enum Submenu {
  Residential_R$ = 0x93dadfe9,
  Residential_R$$ = 0x984e5034,
  Residential_R$$$ = 0x9f83f133,
  Commercial_CS$ = 0x11bf1ca9,
  Commercial_CS$$ = 0x24c43253,
  Commercial_CS$$$ = 0x9bdefe2b,
  Commercial_CO$$ = 0xa7ff7cf0,
  Commercial_CO$$$ = 0xe27b7ef6,
  Industrial_Agriculture = 0xc220b7d8,
  Industrial_Dirty = 0x62d82695,
  Industrial_Manufacture = 0x68b3e5fd,
  Industrial_HighTech = 0x954e20fe,
  Highway_Signage = 0x83e040bb,
  Rail_Passengers = 0x35380c75,
  Rail_Freight = 0x3557f0a1,
  Rail_Yards = 0x39ba25c7,
  Rail_Hybrid = 0x2b294cc2,
  Rail_Monorail = 0x3a1d9854,
  MiscTransit_Bus = 0x1fdde184,
  MiscTransit_Tram = 0x26b51b28,
  MiscTransit_ElRail = 0x244f77e1,
  MiscTransit_Subway = 0x231a97d3,
  MiscTransit_MultiModal = 0x322c7959,
  MiscTransit_Parkings = 0x217b6c35,
  WaterTransit_Seaports = 0x07047b22,
  WaterTransit_Canals = 0x03c6629c,
  WaterTransit_Seawalls = 0x1cd18678,
  WaterTransit_Waterfront = 0x84d42cd6,
  Power_Dirty = 0x4b465151,
  Power_Clean = 0xcde0316b,
  Power_Misc = 0xd013f32d,
  Police_Small = 0x65d88585,
  Police_Large = 0x7d6dc8bc,
  Police_Deluxe = 0x8157ca0e,
  Police_Military = 0x8ba49621,
  Education_Elementary = 0x9fe5c428,
  Education_HighSchool = 0xa08063d0,
  Education_College = 0xac706063,
  Education_Libraries = 0xaedd9faa,
  Health_Small = 0xb1f7ac5b,
  Health_Medium = 0xb7b594d6,
  Health_Large = 0xbc251b69,
  Landmarks_Government = 0x9faf7a3b,
  Landmarks_Religion = 0x26eb3057,
  Landmarks_Entertainment = 0xbe9fda0c,
  Parks_GreenSpaces = 0xbf776d40,
  Parks_Plazas = 0xeb75882c,
  Parks_Sports = 0xce21dbeb,
  Parks_Modular = 0xdeffd960,
  Parks_Embankments = 0xbb531946,
  Parks_Fillers = 0xf034265c,
}

export interface VariantData {
  assets?: Array<AssetID | VariantAssetData>
  authors?: AuthorID[]
  buildings?: BuildingData[]
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
  menu?: string
  mmps?: MMPData[]
  name?: string
  optional?: PackageID[]
  options?: OptionData[]
  release?: Date
  readme?: string
  repository?: string
  requirements?: Requirements
  submenu?: string
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
  buildings?: BuildingInfo[]
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

// TODO: i18n
export function getMenuLabel(menu: number): string {
  return Menu[menu] ?? Submenu[menu] ?? `0x${toHex(menu, 8)}`
}

export function getStateLabel(
  t: TFunction<Namespace>,
  state: VariantState | "default" | "selected",
): string {
  return t(state, { ns: "VariantState" })
}

export function writeMenu(menu: number): string {
  return Menu[menu] ?? Submenu[menu] ?? `0x${toHex(menu, 8)}`
}

export function writeMenus(menus: number[]): string {
  return menus.map(writeMenu).join(",")
}
