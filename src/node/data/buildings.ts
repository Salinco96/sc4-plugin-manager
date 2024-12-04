import type { BuildingID, BuildingInfo } from "@common/buildings"
import type { Categories } from "@common/categories"
import type { FamilyID } from "@common/families"
import type { MaybeArray } from "@common/utils/types"
import { loadCategories } from "./categories"
import { parseMenu, parseMenus, writeMenu, writeMenus } from "./submenus"

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
  category?: MaybeArray<string>

  /**
   * Plop cost
   */
  cost?: number

  /**
   * Building description
   */
  description?: string

  /**
   * Building family ID
   */
  family?: FamilyID

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
  model?: string

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
  const { category, menu, model, submenu, ...others } = data

  return {
    categories: category ? loadCategories(category, categories) : undefined,
    file,
    id,
    menu: menu ? parseMenu(menu) : undefined,
    submenus: submenu ? parseMenus(submenu) : undefined,
    ...others,
  }
}

export function writeBuildingInfo(building: BuildingInfo): BuildingData {
  const { categories, file, id, menu, submenus, ...others } = building

  return {
    category: categories?.join(","),
    menu: menu ? writeMenu(menu) : undefined,
    submenu: submenus?.length ? writeMenus(submenus) : undefined,
    ...others,
  }
}
