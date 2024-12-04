/** Raw asset data */
export interface AssetData {
  /** ISO string date */
  lastModified?: Date | string
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
