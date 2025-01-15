import type { BuildingID } from "@common/buildings"
import { type LotID, type LotInfo, ZoneDensity } from "@common/lots"
import type { Requirements } from "@common/options"
import type { PropID } from "@common/props"
import { type MaybeArray, parseStringArray } from "@common/utils/types"
import type { TextureID } from "@common/variants"
import { isEnum, size, sort, unique, values } from "@salinco/nice-utils"

export interface LotData {
  /**
   * Building instance ID
   */
  building?: BuildingID

  /**
   * Whether lot is enabled by default
   *
   * Defaults to `true`.
   */
  default?: boolean

  /**
   * Zone density where this lot may grow (array or comma-separated `"low"` / `"medium"` / `"high"`, or `"all"`)
   */
  density?: MaybeArray<string> | "all"

  /**
   * URL or relative path within ~docs
   */
  images?: string[]

  /**
   * Internal lot name
   */
  name?: string

  /**
   * Instance IDs of all props used by this lot
   */
  props?: MaybeArray<string>

  /**
   * Lot instance IDs to replace with this one (e.g. different ID for DN/MN)
   */
  replace?: MaybeArray<string>

  /**
   * Whether this lot replaces a Maxis lot that may suffer from phantom slider bug
   */
  replaceMaxis?: boolean

  /**
   * Requirements (e.g. CAM for stage 9+ growables)
   */
  requirements?: Requirements

  /**
   * Lot size in AxB format (e.g. 2x3)
   */
  size?: `${number}x${number}`

  /**
   * Growth stage
   */
  stage?: number

  /**
   * Instance IDs of all textures used by this lot
   */
  textures?: MaybeArray<string>
}

export function loadLotInfo(file: string, id: LotID, data: LotData): LotInfo {
  return {
    building: data.building,
    default: data.default,
    density:
      data.density === "all"
        ? values(ZoneDensity)
        : data.density?.length
          ? unique(parseStringArray(data.density).filter(value => isEnum(value, ZoneDensity)))
          : undefined,
    file,
    images: data.images,
    id,
    name: data.name,
    props: data.props ? (unique(parseStringArray(data.props)) as PropID[]) : undefined,
    replace: data.replace ? (unique(parseStringArray(data.replace)) as LotID[]) : undefined,
    replaceMaxis: data.replaceMaxis,
    requirements: data.requirements,
    size: data.size,
    stage: data.stage,
    textures: data.textures ? (unique(parseStringArray(data.textures)) as TextureID[]) : undefined,
  }
}

export function writeLotInfo(lot: LotInfo): LotData {
  return {
    building: lot.building,
    default: lot.default,
    density: lot.density?.length === size(ZoneDensity) ? "all" : lot.density?.join(","),
    images: lot.images,
    name: lot.name,
    props: lot.props && sort(lot.props).join(","),
    replace: lot.replace && sort(lot.replace).join(","),
    replaceMaxis: lot.replaceMaxis,
    requirements: lot.requirements,
    size: lot.size,
    stage: lot.stage,
    textures: lot.textures && sort(lot.textures).join(","),
  }
}
