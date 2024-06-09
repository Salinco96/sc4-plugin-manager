import { AssetInfo, PackageAsset } from "@common/types"

export function toAssetInfo(data: PackageAsset): AssetInfo | undefined {
  // Parse asset ID in format `source:id[#hash]@version`
  const match = data.id.match(/^([\w-]+):([\w./-]+)(?:#([\w./-]+))?@([\w.-]+)$/)
  if (match) {
    const [, source, id, hash, version] = match

    switch (source) {
      // id = owner/repository
      // version = release version
      // hash = release artifact filename
      case "github":
        return {
          id: `${source}/${id}/${hash}`,
          sha256: data.sha256,
          size: data.size,
          url: `https://github.com/${id}/releases/download/${version}/${hash}`,
          version,
        }

      // id = download ID
      case "sc4evermore":
        return {
          id: `${source}/${id}`,
          sha256: data.sha256,
          size: data.size,
          url: `https://www.sc4evermore.com/index.php/downloads?task=download.send&id=${id.replace("-", ":")}`,
          version,
        }

      // id = download ID
      // hash = variant (optional, only for downloads with multiple variants or to target older versions)
      case "simtropolis":
        return {
          id: `${source}/${id}${hash ? `#${hash}` : ""}`,
          sha256: data.sha256,
          size: data.size,
          url: `https://community.simtropolis.com/files/file/${id}/?do=download${hash ? `&r=${hash}` : ""}`,
          version,
        }
    }
  }
}
