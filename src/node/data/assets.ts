import type { AssetID, AssetInfo } from "@common/assets"
import { raise } from "@salinco/nice-utils"
import { loadDate, loadInteger, loadString } from "./utils"

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

export function getAssetDefaultURL(assetId: AssetID): string | undefined {
  const { hash, path, source } = parseAssetId(assetId)

  switch (source) {
    // path = download ID
    case "sc4evermore":
      return `https://www.sc4evermore.com/index.php/downloads?task=download.send&id=${path.replace("-", ":")}`

    // path = download ID
    // hash = variant (optional, only for downloads with multiple variants or to target older versions)
    case "simtropolis":
      return `https://community.simtropolis.com/files/file/${path}/?do=download${hash ? `&r=${hash}` : ""}`

    // path = download ID (only the first numeric part)
    case "toutsimcities":
      return `https://www.toutsimcities.com/downloads/start/${path.split("-")[0]}`
  }
}

export function getAssetKey(assetId: AssetID, version: string): string {
  return version ? `${assetId}@${version}` : assetId
}

function getAssetURL(assetId: AssetID, rawUrl?: string, version?: string): string {
  if (rawUrl) {
    let url = rawUrl

    const { hash } = parseAssetId(assetId)
    if (hash) {
      url = url.replaceAll("{hash}", hash)
    }

    if (version) {
      url = url.replaceAll("{version}", version)
    }

    return url
  }

  const defaultUrl = getAssetDefaultURL(assetId)

  if (defaultUrl) {
    return defaultUrl
  }

  raise(`Could not infer URL for asset ID ${assetId}`)
}

export function loadAssetInfo(assetId: AssetID, data: AssetData, downloaded?: string[]): AssetInfo {
  const rawUrl = loadString(data.url, assetId, "url")
  const version = loadString(data.version, assetId, "version") ?? "1.0"
  const url = getAssetURL(assetId, rawUrl, version)

  return {
    downloaded: Object.fromEntries(downloaded?.map(version => [version, true]) ?? []),
    id: assetId,
    lastModified: loadDate(data.lastModified, assetId, "lastModified"),
    sha256: loadString(data.sha256, assetId, "sha256"),
    size: loadInteger(data.size, assetId, "size"),
    uncompressed: loadInteger(data.uncompressed, assetId, "uncompressed"),
    url,
    version,
  }
}

export function writeAssetInfo(assetInfo: AssetInfo): AssetData {
  let url: string | undefined

  // Omit URL if equal to default one, also use relacements for hash and version
  if (assetInfo.url !== getAssetDefaultURL(assetInfo.id)) {
    url = assetInfo.url

    if (assetInfo.version.includes(".")) {
      url = url.replaceAll(assetInfo.version, "{version}")
    }

    const { hash } = parseAssetId(assetInfo.id)
    if (hash) {
      url = url.replaceAll(hash, "{hash}")
    }
  }

  return {
    lastModified: assetInfo.lastModified,
    sha256: assetInfo.sha256,
    size: assetInfo.size,
    uncompressed: assetInfo.uncompressed,
    url,
    version: assetInfo.version,
  }
}

/**
 * Parses asset ID in format `source/path[#hash]`
 */
function parseAssetId(assetId: AssetID): { hash?: string; path: string; source: string } {
  const [source, pathWithHash] = assetId.split("/", 2)
  const [path, hash] = pathWithHash.split("#")
  return { hash, path, source }
}
