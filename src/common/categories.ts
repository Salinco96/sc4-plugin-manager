import { ID } from "@salinco/nice-utils"
import type { VariantInfo } from "./variants"

/** Category ID */
export type CategoryID = ID<string, CategoryInfo>

export const CategoryID = {
  AGRICULTURE: ID("agriculture"),
  AIRPORTS: ID("airports"),
  AUTOMATA: ID("automata"),
  BUS: ID("bus"),
  CAM: ID("cam"),
  CANALS: ID("canals"),
  CHEATS: ID("cheats"),
  COMMERCIAL: ID("commercial"),
  CO$$: ID("co$$"),
  CO$$$: ID("co$$$"),
  CIVICS: ID("civics"),
  CS$: ID("cs$"),
  CS$$: ID("cs$$"),
  CS$$$: ID("cs$$$"),
  DEPENDENCIES: ID("dependencies"),
  DLL: ID("dll"),
  EDUCATION: ID("education"),
  FERRY: ID("ferry"),
  FILLERS: ID("fillers"),
  FLORA: ID("flora"),
  FREIGHT: ID("freight"),
  GAMEPLAY: ID("gameplay"),
  GRAPHICS: ID("graphics"),
  HEALTH: ID("health"),
  ID: ID("i-d"),
  IHT: ID("i-m"),
  IM: ID("i-ht"),
  INDUSTRY: ID("industry"),
  LANDMARKS: ID("landmarks"),
  MARINA: ID("marina"),
  MMPS: ID("mmps"),
  MODS: ID("mods"),
  MONORAIL: ID("monorail"),
  NAM: ID("nam"),
  ORDINANCES: ID("ordinances"),
  PARKS: ID("parks"),
  PASSENGERS: ID("passengers"),
  POLICE: ID("police"),
  POWER: ID("power"),
  PROPS: ID("props"),
  RAIL: ID("rail"),
  RELIGION: ID("religion"),
  RESIDENTIAL: ID("residential"),
  REWARDS: ID("rewards"),
  R$: ID("r$"),
  R$$: ID("r$$"),
  R$$$: ID("r$$$"),
  SEAPORTS: ID("seaports"),
  SPAM: ID("spam"),
  SUBWAY: ID("subway"),
  TERRAINS: ID("terrains"),
  TEXTURES: ID("textures"),
  TRAM: ID("tram"),
  TRANSPORT: ID("transport"),
  UTILITIES: ID("utilities"),
  WASTE: ID("waste"),
  WATER: ID("water"),
  WATERFRONT: ID("waterfront"),
} as const satisfies {
  [category: string]: CategoryID
}

/** Category info */
export interface CategoryInfo {
  label: string
  /** Parent category ID (if any) */
  parent?: CategoryID
  /** Priority (between 0 and 999) */
  priority?: number
}

/** Loaded categories */
export type Categories = {
  [categoryId in CategoryID]?: CategoryInfo
}

export function getCategories(variantInfo: VariantInfo): CategoryID[] {
  return variantInfo.categories
}

export function getCategoryLabel(categoryId: CategoryID, categories: Categories): string {
  const info = categories[categoryId]

  if (info) {
    return info.label
  }

  console.error(`Unknown category '${categoryId}'`)
  return categoryId
}

export function isCategory(variantInfo: VariantInfo, categoryId: CategoryID): boolean {
  return variantInfo.categories.includes(categoryId)
}
