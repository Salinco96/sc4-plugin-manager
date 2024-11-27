import type { CategoryID } from "./categories"
import type { TGI } from "./dbpf"
import type { MaybeArray } from "./utils/types"

export interface BuildingData {
  /** Bulldoze cost */
  bulldoze?: number
  /** RCI capacity */
  capacity?: {
    /** Medium-Wealth Offices */
    co$$?: number
    /** High-Wealth Offices */
    co$$$?: number
    /** Low-Wealth Services */
    cs$?: number
    /** Medium-Wealth Services */
    cs$$?: number
    /** High-Wealth Services */
    cs$$$?: number
    /** Dirty Industry */
    id?: number
    /** High-Tech Industry */
    iht?: number
    /** Manufacture */
    im?: number
    /** Agriculture */
    ir?: number
    /** Low-Wealth Residential */
    r$?: number
    /** Medium-Wealth Residential */
    r$$?: number
    /** High-Wealth Residential */
    r$$$?: number
  }
  /** Category */
  category?: MaybeArray<string>
  /** Plop cost */
  cost?: number
  /** Lot description */
  description?: string
  /** Path to the file containing the building exemplar */
  filename: string
  /** Flamability (number between 0 and 100) */
  flamability?: number
  /** Garbage generated */
  garbage?: number
  /** Garbage radius in tiles */
  garbageRadius?: number
  /** Building Instance ID */
  id: string
  /** URL or relative path within ~docs */
  images?: string[]
  /** Monthly income */
  income?: number
  /** Non-RCI jobs */
  jobs?: {
    /** Low-Wealth */
    $?: number
    /** Medium-Wealth */
    $$?: number
    /** High-Wealth */
    $$$?: number
  }
  /** Lot name */
  label?: string
  /** Landmark effect */
  landmark?: number
  /** Landmark effect radius in tiles */
  landmarkRadius?: number
  /** Monthly maintenance cost */
  maintenance?: number
  /** Menu */
  menu?: number | string
  /** TGI of building model */
  model?: TGI
  /** Internal building name */
  name?: string
  /** Radiation generated */
  radiation?: number
  /** Radiation radius in tiles */
  radiationRadius?: number
  /** CAP relief */
  relief?: {
    /** Medium-Wealth Offices */
    co$$?: number
    /** High-Wealth Offices */
    co$$$?: number
    /** Dirty Industry */
    id?: number
    /** High-Tech Industry */
    iht?: number
    /** Manufacture */
    im?: number
    /** Agriculture */
    ir?: number
    /** Low-Wealth Residential */
    r$?: number
    /** Medium-Wealth Residential */
    r$$?: number
    /** High-Wealth Residential */
    r$$$?: number
  }
  /** Air pollution generated */
  pollution?: number
  /** Air pollution radius in tiles */
  pollutionRadius?: number
  /** Electricity consumed */
  power?: number
  /** Electricity produced */
  powerProduction?: number
  /** Mayor rating effect */
  rating?: number
  /** Mayor rating effect radius in tiles */
  ratingRadius?: number
  /** Submenus */
  submenu?: MaybeArray<number | string>
  /** Water consumed */
  water?: number
  /** Water pollution generated */
  waterPollution?: number
  /** Water pollution radius in tiles */
  waterPollutionRadius?: number
  /** Water produced */
  waterProduction?: number
  /** Building value */
  worth?: number
}

export interface BuildingInfo extends Omit<BuildingData, "category" | "menu" | "submenu"> {
  categories?: CategoryID[]
  menu?: number
  submenus?: number[]
}
