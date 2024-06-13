import { AssetData, AssetInfo } from "@common/types"
import { isDev } from "@utils/env"

export function getAssetKey(assetId: string, version?: string): string {
  return version ? `${assetId}@${version}` : assetId
}

export function getAssetURL(assetId: string, data: AssetData): string | undefined {
  // Parse asset ID in format `source/path[#hash]`
  const match = assetId.match(/^([\w-]+)[/]([\w./-]+)(?:[#]([\w./-]+))?$/)

  if (data.url) {
    let url = data.url

    if (match) {
      url = url.replaceAll("{path}", match[2])
      url = url.replaceAll("{hash}", match[3])
    }

    if (data.version !== undefined) {
      url = url.replaceAll("{version}", String(data.version))
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
  }
}

export function loadAssetInfo(assetId: string, data: AssetData): AssetInfo | undefined {
  const version = data.version !== undefined ? String(data.version) : undefined
  const url = getAssetURL(assetId, data)
  if (url) {
    return { ...data, id: assetId, url, version }
  } else if (isDev()) {
    // Fail in development so we can notice issues more easily
    throw Error(`Could not infer URL for asset ID ${assetId}`)
  } else {
    // Fail in development so we can notice issues more easily
    console.warn(`Could not infer URL for asset ID ${assetId}`)
  }
}
