import type { BuildingID, BuildingInfo } from "@common/buildings"
import type { Categories } from "@common/categories"
import { parseStringArray, type MaybeArray } from "@common/utils/types"
import { loadCategories } from "./categories"
import { writeCategories } from "./categories"
import { parseMenu, parseMenus, writeMenu, writeMenus } from "./submenus"
import type { FamilyID } from "@common/families"

export interface BuildingData {
  /**
   * Bulldoze cost
   */
  bulldoze?: number

  /**
   * RCI capacity
   */
  capacity?: {
    co$$?: number
    co$$$?: number
    cs$?: number
    cs$$?: number
    cs$$$?: number
    id?: number
    iht?: number
    im?: number
    ir?: number
    r$?: number
    r$$?: number
    r$$$?: number
  }

  /**
   * Categories
   */
  categories?: MaybeArray<string>

  /**
   * Plop cost
   */
  cost?: number

  /**
   * Building description
   */
  description?: string

  /**
   * Building family IDs
   */
  family?: MaybeArray<string>

  /**
   * Flamability (number between 0 and 100)
   */
  flamability?: number

  /**
   * Garbage generated
   */
  garbage?: number

  /**
   * Garbage radius in tiles
   */
  garbageRadius?: number

  /**
   * URL or relative path within ~docs
   */
  images?: string[]

  /**
   * Monthly income
   */
  income?: number

  /**
   * Non-RCI jobs
   */
  jobs?: {
    $?: number
    $$?: number
    $$$?: number
  }

  /**
   * Building name
   */
  label?: string

  /**
   * Landmark effect
   */
  landmark?: number

  /**
   * Landmark effect radius in tiles
   */
  landmarkRadius?: number

  /**
   * Monthly maintenance cost
   */
  maintenance?: number

  /**
   * Menu
   */
  menu?: number | string

  /**
   * Model ID
   */
  model?: string | null

  /**
   * Internal exemplar name
   */
  name?: string

  /**
   * Radiation generated
   */
  radiation?: number

  /**
   * Radiation radius in tiles
   */
  radiationRadius?: number

  /**
   * CAP relief
   */
  relief?: {
    co$$?: number
    co$$$?: number
    id?: number
    iht?: number
    im?: number
    ir?: number
    r$?: number
    r$$?: number
    r$$$?: number
  }

  /**
   * Air pollution generated
   */
  pollution?: number

  /**
   * Air pollution radius in tiles
   */
  pollutionRadius?: number

  /**
   * Electricity consumed
   */
  power?: number

  /**
   * Electricity produced
   */
  powerProduction?: number

  /**
   * Mayor rating effect
   */
  rating?: number

  /**
   * Mayor rating effect radius in tiles
   */
  ratingRadius?: number

  /**
   * Submenus
   */
  submenu?: MaybeArray<number | string>

  /**
   * Water consumed
   */
  water?: number

  /**
   * Water pollution generated
   */
  waterPollution?: number

  /**
   * Water pollution radius in tiles
   */
  waterPollutionRadius?: number

  /**
   * Water produced
   */
  waterProduction?: number

  /**
   * Building value
   */
  worth?: number
}

export function loadBuildingInfo(
  file: string,
  id: BuildingID,
  data: BuildingData,
  categories: Categories,
): BuildingInfo {
  const { family, menu, submenu, ...others } = data

  return {
    ...others,
    categories: data.categories ? loadCategories(data.categories, categories) : undefined,
    families: family ? (parseStringArray(family) as FamilyID[]) : undefined,
    file,
    id,
    menu: menu ? parseMenu(menu) : undefined,
    submenus: submenu ? parseMenus(submenu) : undefined,
  }
}

export function writeBuildingInfo(building: BuildingInfo, categories: Categories): BuildingData {
  const { categories: buildingCategories, families, file, id, menu, submenus, ...others } = building

  return {
    ...others,
    categories: buildingCategories?.length
      ? writeCategories(buildingCategories, categories)
      : undefined,
    family: families?.length ? families?.join(",") : undefined,
    menu: menu ? writeMenu(menu) : undefined,
    submenu: submenus?.length ? writeMenus(submenus) : undefined,
  }
}
