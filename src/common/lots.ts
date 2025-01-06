import { type ID, unique } from "@salinco/nice-utils"
import type { BuildingID } from "./buildings"
import type { OptionInfo, Requirements } from "./options"
import { type PackageID, checkCondition } from "./packages"
import type { ProfileInfo } from "./profiles"
import type { PropID } from "./props"
import type { Settings } from "./settings"
import type { Features, PackageConfig } from "./types"
import type { VariantInfo } from "./variants"

export enum ZoneDensity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export type LotID = ID<string, LotInfo>

export interface LotInfo {
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
  density?: ZoneDensity[]

  /**
   * Path to exemplar file (POSIX)
   */
  file: string

  /**
   * Lot instance ID
   */
  id: LotID

  /**
   * URL or relative path within ~docs
   */
  images?: string[]

  /**
   * Internal lot name
   */
  name?: string

  /**
   * Prop IDS - indexer only
   */
  props?: PropID[]

  /**
   * Lot instance ID to replace with this one (e.g. different ID for DN/MN)
   */
  replace?: LotID

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
   * Texture IDS - indexer only
   */
  textures?: string[]
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
