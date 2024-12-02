import type { Requirements } from "./options"
import type { MaybeArray } from "./utils/types"

export enum ZoneDensity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export interface LotData {
  /** Building exemplar instance ID */
  building?: string
  /** Whether lot is enabled by default (this defaults to true) */
  default?: boolean
  /** Zone density where this lot may grow - comma-separated: "low", "medium", "high" */
  density?: MaybeArray<string>
  /** Path to the file containing the lot exemplar */
  file: string
  /** Lot Instance ID */
  id: string
  /** URL or relative path within ~docs */
  images?: string[]
  /** Internal lot name */
  name?: string
  /** Instance IDs of all props used by this lot */
  props?: string[]
  /** Lot Instance ID to replace with this one (e.g. different ID for DN/MN) */
  replace?: string
  /** Whether this lot replaces a Maxis lot that may suffer from phantom slider bug */
  replaceMaxis?: boolean
  /** Requirements (e.g. CAM for stage 9+ growables) */
  requirements?: Requirements
  /** Lot size in AxB format (e.g. 2x3) */
  size?: `${number}x${number}`
  /** Growth stage */
  stage?: number
  /** Instance IDs of all textures used by this lot */
  textures?: string[]
}

export interface LotInfo extends Omit<LotData, "density"> {
  density?: ZoneDensity[]
}
