import type { AssetData, AssetID, AssetInfo } from "@common/assets"
import { failInDev } from "@utils/env"

import { loadDate, loadInteger, loadString } from "./loader"

export function getAssetKey(assetId: AssetID, version: string): string {
  return version ? `${assetId}@${version}` : assetId
}

function getAssetURL(
  assetId: string,
  rawUrl: string | undefined,
  version: string | undefined,
): string | undefined {
  // Parse asset ID in format `source/path[#hash]`
  const match = assetId.match(/^([\w-]+)[/]([%\w./-]+)(?:[#]([\w./-]+))?$/)

  if (rawUrl) {
    let url = rawUrl

    if (match) {
      url = url.replaceAll("{hash}", match[3])
    }

    if (version) {
      url = url.replaceAll("{version}", version)
    }

    return url
  }

  if (match) {
    const [, source, path, hash] = match

    // path = download ID
    if (source === "sc4evermore") {
      return `https://www.sc4evermore.com/index.php/downloads?task=download.send&id=${path.replace("-", ":")}`
    }

    // path = download ID
    // hash = variant (optional, only for downloads with multiple variants or to target older versions)
    if (source === "simtropolis") {
      return `https://community.simtropolis.com/files/file/${path}/?do=download${hash ? `&r=${hash}` : ""}`
    }

    // path = download ID (only the first numeric part)
    if (source === "toutsimcities") {
      return `https://www.toutsimcities.com/downloads/start/${path.split("-")[0]}`
    }
  }
}

export function loadAssetInfo(
  assetId: string,
  data: AssetData,
  downloaded?: string[],
): AssetInfo | undefined {
  const rawUrl = loadString(data.url, assetId, "url")
  const version = loadString(data.version, assetId, "version") ?? "1.0"
  const url = getAssetURL(assetId, rawUrl, version)
  if (url) {
    return {
      downloaded: Object.fromEntries(downloaded?.map(version => [version, true]) ?? []),
      id: assetId as AssetID,
      lastModified: loadDate(data.lastModified, assetId, "lastModified"),
      sha256: loadString(data.sha256, assetId, "sha256"),
      size: loadInteger(data.size, assetId, "size"),
      uncompressed: loadInteger(data.uncompressed, assetId, "uncompressed"),
      url,
      version,
    }
  }

  failInDev(`Could not infer URL for asset ID ${assetId}`)
}
