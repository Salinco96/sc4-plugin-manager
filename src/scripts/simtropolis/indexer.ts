import path from "path"

import { config } from "dotenv"
import { glob } from "glob"

import { ConfigFormat, PackageData, VariantData } from "@common/types"
import { loadConfig, writeConfig } from "@node/configs"
import { download } from "@node/download"
import { extractRecursively } from "@node/extract"
import { get } from "@node/fetch"
import { exists, getExtension } from "@node/files"

import { readHTML, wait } from "../utils"

import { Category, categories } from "./constants"

config({ path: ".env.local" })

const origin = "https://community.simtropolis.com"

const outDir = path.join(__dirname, "../out")
const dbDir = path.join(__dirname, "../../../sc4-plugin-manager-data")
const assetsDir = path.join(outDir, "assets")
const downloadsDir = path.join(outDir, "downloads")

const ips4_IPSSessionFront = process.env.SIMTROPOLIS_IPS4_IPSSESSIONFRONT
const ips4_member_id = process.env.SIMTROPOLIS_IPS4_MEMBER_ID

if (!ips4_IPSSessionFront || !ips4_member_id) {
  throw Error("Missing Simtropolis credentials")
}

const cookies = {
  ips4_IPSSessionFront,
  ips4_member_id,
}

interface SimtropolisAssetData {
  author?: string
  category?: number
  description?: string
  images?: string[]
  lastModified?: string
  packageId?: string
  name?: string
  sha256?: string
  size?: number
  thumbnail?: string
  uncompressed?: number
  url?: string
  variants?: { [variant: string]: string }
  variantName?: string
  version?: string
}

interface AssetListData {
  assets: { [assetId: string]: SimtropolisAssetData }
  lastModified: string
}

run({ minDate: "2024-06-01T00:00:00Z", onlyCache: true })

async function run(options: { minDate: string; onlyCache?: boolean }) {
  const configDir = path.join(dbDir, "assets")
  const configName = "simtropolis"
  const config = await loadConfig<{
    [assetId: string]: SimtropolisAssetData
  }>(configDir, configName)

  const assets = config?.data ?? {}

  // Load list of entries
  for (const category of categories) {
    const data = await fetchCategory(category, options)
    for (const assetId in data.assets) {
      const { url, ...asset } = data.assets[assetId]
      if (!asset.lastModified || asset.lastModified > options.minDate) {
        const oldData = assets[assetId]
        const newData = { ...oldData, ...asset }
        assets[assetId] = newData
        // if (!newData.version || newData.lastModified !== oldData?.lastModified) {
        await fetchAssetDetails(assetId)
        await writeConfig(configDir, configName, assets, ConfigFormat.YAML)
        // }
      }
    }
  }

  async function fetchAssetDetails(assetId: string) {
    console.debug(assetId)

    const asset = assets[assetId]
    const [, fileId, variant] = assetId.match(/^simtropolis[/]([\w-]+)(?:#([\w-]+))?$/)!
    const url = `${origin}/files/file/${fileId}`

    if (!asset.version || !options.onlyCache) {
      console.debug(`Fetching ${url}...`)

      const html = await readHTML(await get(url, { cookies: () => cookies }))

      asset.version = html.querySelector(".stex-title-version")?.textContent

      asset.description = html
        .querySelectorAll("article section .ipsType_richText")[0]
        ?.innerHTML.replaceAll("\u00a0", " ")
        .replaceAll("\u2013", "-")
        .replaceAll("\u2018", "'")
        .replaceAll("\u2019", "'")
        .replaceAll("&amp;", "&")
        .replaceAll("&apos;", "'")
        .replaceAll("&gt;", ">")
        .replaceAll("&lt;", "<")
        .replaceAll("&quot;", '"')
        .replace(/\s+/g, " ")
        .replace(/<iframe(.*)>(.*)<[/]iframe>/g, "")
        .replace(/<br( [^>]*)?>/g, "\n")
        .replace(/<p( [^>]*)?>/g, "\n\n")
        .replace(/<[/]li>/g, "\n")
        .replace(/<[/]ol>/g, "\n")
        .replace(/<[/]ul>/g, "\n")
        .replace(/<[/]p>/g, "\n\n")
        .replace(/\n */g, "\n")
        .replace(/\s*<li( [^>]*)?>/g, "\n  - ")
        .replace(/<[/]?[a-z]+( [^>]*)?>/g, "")
        .replace(/\n\n+/g, "\n\n")
        .replace(/ *\n/g, "\n")
        .replace(/\s*$/g, "")
        .replace(/^\s*/g, "")

      asset.images = html
        .querySelectorAll("#ipsLayout_mainArea .ipsCarousel_item img")
        .map(element => element.attributes.src)
    }

    const downloadPath = path.join(downloadsDir, `${assetId}@${asset.version}`)
    const downloaded = await exists(downloadPath)

    if (!asset.variants && !downloaded) {
      const downloadUrl = `${url}/?do=download${variant ? `&r=${variant}` : ""}`

      const response = await get(downloadUrl, { cookies: () => cookies })

      const contentType = response.headers.get("Content-Type")

      if (contentType?.startsWith("text/html")) {
        if (variant) {
          throw Error("Variant should not have variants")
        }

        const html = await readHTML(response)
        const items = html.querySelector('[data-controller="downloads.front.view.download"]')
        if (!items) {
          throw Error("Missing variants")
        }

        const variants: { [variant: string]: string } = {}
        for (const item of items.querySelectorAll(".ipsDataItem")) {
          const variantName = item.querySelector(".ipsDataItem_title")?.textContent
          const variant = item.querySelector("a")?.attributes.href.match(/&r=(\w+)/)?.[1]
          if (variant && variantName) {
            variants[variant] = variantName
          }
        }

        assets[assetId] = {
          lastModified: asset.lastModified,
          variants,
          version: asset.version,
        }
      } else {
        const { sha256, size, uncompressedSize } = await download(response, { downloadPath })

        asset.sha256 = sha256
        asset.size = size
        asset.uncompressed = uncompressedSize

        await extractRecursively(downloadUrl)
      }
    }

    if (asset.variants && !variant) {
      for (const variant in asset.variants) {
        const variantAssetId = `${assetId}#${variant}`
        assets[variantAssetId] = { ...asset, variantName: asset.variants[variant] }
        await fetchAssetDetails(variantAssetId)
      }
    }

    if (asset.packageId && downloaded) {
      const packageId = asset.packageId
      delete asset.packageId

      console.error(`Creating package ${packageId}...`)

      const configDir = path.join(dbDir, "packages")
      const configName = packageId.split("/")[0]
      const config = await loadConfig<{ [packageId: string]: PackageData }>(configDir, configName)

      const packages = config?.data ?? {}
      const packageData = (packages[packageId] ??= {})

      if (asset.author) {
        packageData.authors = [asset.author]
        delete asset.author
      }

      if (asset.category) {
        packageData.category = asset.category
        delete asset.category
      }

      if (asset.description) {
        packageData.description = asset.description
        delete asset.description
      }

      if (asset.name) {
        packageData.name = asset.name
        delete asset.name
      }

      if (asset.thumbnail) {
        packageData.thumbnail = asset.thumbnail
        delete asset.thumbnail
      }

      packageData.url = url
      packageData.variants ??= {}

      let variantData: VariantData
      if (asset.variantName) {
        const variantId = asset.variantName.toLowerCase().split(".")[0].replace(/\W+/g, "-")
        variantData = packageData.variants[variantId] ??= {}
        delete asset.variantName
      } else {
        variantData = packageData.variants.default ??= {}
      }

      const files = await glob("**", {
        cwd: downloadPath,
        nodir: true,
      })

      const docs: string[] = []
      const include: string[] = []
      for (const file of files) {
        if (
          [".dat", ".dll", ".ini", "._loosedesc", ".sc4desc", ".sc4lot", ".sc4model"].includes(
            getExtension(file),
          )
        ) {
          include.push(file.replaceAll(path.sep, "/"))
        } else {
          docs.push(file.replaceAll(path.sep, "/"))
        }
      }

      variantData.assets = [{ docs, id: assetId, include }]

      if (asset.version) {
        const [, major, minor, patch] = asset.version.match(/(\d+)(?:[.](\d+)(?:[.](\d+))?)?/)!
        variantData.version = `${major}.${minor ?? 0}.${patch ?? 0}`
      }

      await writeConfig(configDir, configName, packages, ConfigFormat.YAML, config?.format)
    }
  }
}

async function fetchCategory(
  category: Category,
  options: { onlyCache?: boolean } = {},
): Promise<AssetListData> {
  const configName = `simtropolis/assets-${category.path}`
  const config = await loadConfig<AssetListData>(assetsDir, configName)

  const now = new Date().toISOString()
  const lastCacheTime = config?.data.lastModified
  const data = { assets: {}, ...config?.data, lastModified: now }

  if (!lastCacheTime || !options.onlyCache) {
    let nPages: number | undefined
    let page = 1

    do {
      const url = `${origin}/files/category/${category.path}/?sortby=file_updated&sortdirection=desc&page=${page}`
      console.debug(`Page ${page} of ${nPages ?? "?"}: ${url}`)

      const html = await readHTML(await get(url, { cookies: () => cookies }))
      if (!nPages) {
        const pageJump = html.querySelector("li.ipsPagination_pageJump a")
        const match = pageJump?.textContent.match(/page (\d+) of (\d+)/i)
        nPages = match ? Number.parseInt(match[2], 10) : 1
      }

      const items = html.querySelectorAll("div.cDownloadsCategoryTable li.ipsDataItem")
      for (const item of items) {
        const imageUrl = item.querySelector("[data-bg]")?.attributes["data-bg"]
        const title = item.querySelector(".ipsDataItem_title > span:last-of-type a")
        const itemName = title?.textContent.trim()
        const itemUrl = title?.attributes.href
        const itemId = itemUrl?.match(/[/]file[/]([%\w-]+)[/]?$/)?.[1]
        const author = item.querySelector(".ipsDataItem_main > p:first-of-type a")
        const authorName = author?.textContent.trim()
        const lastModified = item.querySelector("[datetime]")?.attributes.datetime

        // Results are sorted by last-modified-time (most recent first)
        // If we encounter any item last modified before our last cache time, we are thus done with new items
        if (lastModified && lastCacheTime && lastModified < lastCacheTime) {
          page = nPages
          break
        }

        if (!itemName) {
          throw Error(`Failed to extract name for item ${items.indexOf(item) + 1}`)
        }

        if (!itemUrl) {
          throw Error(`Failed to extract URL for ${itemName}`)
        }

        if (!itemId) {
          throw Error(`Failed to extract ID for ${itemName}`)
        }

        const assetId = `simtropolis/${itemId}`
        const authorId = authorName?.toLowerCase().replace(/\W+/g, "-") ?? "simtropolis"
        const packageId = `${authorId}/${decodeURIComponent(itemId.replace(/^(\d+)-/, "").replace(/\W+/g, "-"))}`

        const asset: SimtropolisAssetData = {
          author: authorName,
          category: category.category,
          thumbnail: imageUrl,
          lastModified: lastModified,
          packageId,
          name: itemName,
          url: itemUrl,
        }

        data.assets[assetId] = asset
      }

      await wait(3000)
    } while (page++ < nPages)

    await writeConfig(assetsDir, configName, data, ConfigFormat.YAML, config?.format)
  }

  return data
}
