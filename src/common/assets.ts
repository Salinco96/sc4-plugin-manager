import type { ID } from "@salinco/nice-utils"

/** Asset ID */
export type AssetID = ID<string, AssetInfo>

/** Raw asset data */
export interface AssetData {
  /** ISO string date */
  lastModified?: Date
  /** SHA-256 of downloaded archive */
  sha256?: string
  /** Size of downloaded archive in bytes */
  size?: number
  /** Size of extracted files in bytes */
  uncompressed?: number
  /** Download URL */
  url?: string
  /** File version as specified by the source */
  version?: number | string
}

/** Loaded asset data */
export interface AssetInfo {
  /** Downloaded versions */
  downloaded: { [version in string]?: boolean }
  /** ISO string date */
  lastModified?: string
  /** SHA-256 of downloaded archive */
  sha256?: string
  /** Size of downloaded archive in bytes */
  size?: number
  /** Size of extracted files in bytes */
  uncompressed?: number
  /** Asset ID */
  id: AssetID
  /** Download URL */
  url: string
  /** File version as specified by the source */
  version: string
}

/** Loaded assets */
export type Assets = {
  [assetId in AssetID]?: AssetInfo
}
