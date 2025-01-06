import type { ID } from "@salinco/nice-utils"

import type { CategoryID } from "./categories"
import type { FamilyID } from "./families"
import type { MenuID } from "./submenus"

export type BuildingID = ID<string, BuildingInfo>

export interface BuildingInfo {
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
  categories?: CategoryID[]

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
  families?: FamilyID[]

  /**
   * Path to exemplar file (POSIX)
   */
  file: string

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
   * Building instance ID
   */
  id: BuildingID

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
  menu?: MenuID

  /**
   * Model ID
   */
  model?: string | null

  /**
   * Internal name
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
  submenus?: MenuID[]

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
