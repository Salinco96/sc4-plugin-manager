import { unique } from "@salinco/nice-utils"
import type { OptionInfo, Requirements } from "./options"
import { type PackageID, checkCondition } from "./packages"
import type { ProfileInfo } from "./profiles"
import type { Settings } from "./settings"
import type { Features, PackageConfig } from "./types"
import type { MaybeArray } from "./utils/types"
import type { VariantInfo } from "./variants"

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
  file: string
  id: string
}

export function isSC4LotFile(filePath: string): boolean {
  return !!filePath.match(/\.SC4Lot$/i)
}

/**
 * Checks whether this lot can be independently disabled.
 *
 * Atm we only allow toggling whole .SC4Lot files.
 */
export function isTogglableLot(lot: LotInfo): boolean {
  return isSC4LotFile(lot.file)
}

/**
 * Checks whether this lot is enabled by default.
 *
 * Lot are always enabled by default, unless `default` is explicitly set to `false`.
 */
export function isDefaultEnabledLot(lot: LotInfo): boolean {
  return lot.default !== false
}

/**
 * Returns the list of enabled lots.
 */
export function getEnabledLots(lots: LotInfo[], packageConfig?: PackageConfig): string[] {
  return (
    packageConfig?.options?.lots ??
    unique(lots.filter(lot => isTogglableLot(lot) && isDefaultEnabledLot(lot)).map(lot => lot.id))
  )
}

/**
 * Checks whether the given lot is currently enabled.
 */
export function isEnabledLot(lot: LotInfo, packageConfig?: PackageConfig): boolean {
  return (
    !isTogglableLot(lot) ||
    (packageConfig?.options?.lots?.includes(lot.id) ?? isDefaultEnabledLot(lot))
  )
}

export function isCompatibleLot(
  lot: LotInfo,
  packageId: PackageID,
  variantInfo: VariantInfo,
  profileInfo: ProfileInfo | undefined,
  profileOptions: ReadonlyArray<OptionInfo>,
  features: Features,
  settings: Settings | undefined,
): boolean {
  const fileInfo = variantInfo.files?.find(file => file.path === lot.file)

  return checkCondition(
    { ...fileInfo?.condition, ...lot.requirements },
    packageId,
    variantInfo,
    profileInfo,
    profileOptions,
    features,
    settings,
  )
}
