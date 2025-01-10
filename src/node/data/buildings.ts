import { sort } from "@salinco/nice-utils"

import type { BuildingID, BuildingInfo } from "@common/buildings"
import type { Categories } from "@common/categories"
import type { GroupID } from "@common/dbpf"
import type { FamilyID } from "@common/families"
import { type MaybeArray, parseStringArray } from "@common/utils/types"

import { loadCategories, writeCategories } from "./categories"
import { loadModelId, writeModelId } from "./packages"
import {
  parseMenu,
  parseMenus,
  parseTilesets,
  writeMenu,
  writeMenus,
  writeTilesets,
} from "./submenus"

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
  model?: GroupID | `${GroupID}-${string}` | null

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
   * Building styles
   */
  tilesets?: MaybeArray<number | string>

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

  /**
   * Whether this building is treated as W2W
   */
  w2w?: boolean
}

export function loadBuildingInfo(
  file: string,
  group: GroupID,
  id: BuildingID,
  data: BuildingData,
  categories: Categories,
): BuildingInfo {
  return {
    bulldoze: data.bulldoze,
    capacity: data.capacity,
    categories: data.categories ? loadCategories(data.categories, categories) : undefined,
    cost: data.cost,
    description: data.description,
    families: data.family ? (parseStringArray(data.family) as FamilyID[]) : undefined,
    flamability: data.flamability,
    file,
    garbage: data.garbage,
    garbageRadius: data.garbageRadius,
    group,
    id,
    images: data.images,
    income: data.income,
    jobs: data.jobs,
    label: data.label,
    landmark: data.landmark,
    landmarkRadius: data.landmarkRadius,
    maintenance: data.maintenance,
    menu: data.menu ? parseMenu(data.menu) : undefined,
    model: data.model && loadModelId(data.model),
    name: data.name,
    pollution: data.pollution,
    pollutionRadius: data.pollutionRadius,
    power: data.power,
    powerProduction: data.powerProduction,
    radiation: data.radiation,
    radiationRadius: data.radiationRadius,
    rating: data.rating,
    ratingRadius: data.ratingRadius,
    relief: data.relief,
    submenus: data.submenu ? parseMenus(data.submenu) : undefined,
    tilesets: data.tilesets ? parseTilesets(data.tilesets) : undefined,
    water: data.water,
    waterPollution: data.waterPollution,
    waterPollutionRadius: data.waterPollutionRadius,
    waterProduction: data.waterProduction,
    worth: data.worth,
    w2w: data.w2w,
  }
}

export function writeBuildingInfo(building: BuildingInfo, categories: Categories): BuildingData {
  return {
    bulldoze: building.bulldoze,
    capacity: building.capacity,
    categories: building.categories?.length
      ? writeCategories(building.categories, categories)
      : undefined,
    cost: building.cost,
    description: building.description,
    family: building.families?.length ? sort(building.families)?.join(",") : undefined,
    flamability: building.flamability,
    garbage: building.garbage,
    garbageRadius: building.garbageRadius,
    images: building.images,
    income: building.income,
    jobs: building.jobs,
    label: building.label,
    landmark: building.landmark,
    landmarkRadius: building.landmarkRadius,
    maintenance: building.maintenance,
    menu: building.menu ? writeMenu(building.menu) : undefined,
    model: building.model && writeModelId(building.model),
    name: building.name,
    pollution: building.pollution,
    pollutionRadius: building.pollutionRadius,
    power: building.power,
    powerProduction: building.powerProduction,
    radiation: building.radiation,
    radiationRadius: building.radiationRadius,
    rating: building.rating,
    ratingRadius: building.ratingRadius,
    relief: building.relief,
    submenu: building.submenus?.length ? writeMenus(building.submenus) : undefined,
    tilesets: building.tilesets?.length ? writeTilesets(building.tilesets) : undefined,
    water: building.water,
    waterPollution: building.waterPollution,
    waterPollutionRadius: building.waterPollutionRadius,
    waterProduction: building.waterProduction,
    worth: building.worth,
    w2w: building.w2w || undefined,
  }
}
