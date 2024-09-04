import { ID } from "./types"

/** Asset ID */
export type AssetID = ID<AssetInfo>

/** Raw asset data */
export interface AssetData {
  /** ISO string date */
  lastModified?: string
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
export interface AssetInfo extends AssetData {
  /** Asset ID */
  id: AssetID
  url: string
  version?: string
}

/** Loaded assets */
export interface Assets {
  [assetId: AssetID]: AssetInfo | undefined
}
