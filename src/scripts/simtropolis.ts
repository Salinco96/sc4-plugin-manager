import { exec } from "child_process"
import { createHash } from "crypto"
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs"
import path from "path"
import { Readable, Transform, pipeline } from "stream"
import { finished } from "stream/promises"
import { ReadableStream } from "stream/web"

import { config } from "dotenv"
import { Open } from "unzipper"
import { parse as yamlParse, stringify as yamlStringify } from "yaml"

import { PackageData, VariantData } from "@common/types"

import { get, getHTML, readHTML, wait } from "./utils"

config({ path: ".env.local" })

const origin = "https://community.simtropolis.com"
const outDir = path.join(__dirname, "out")
const dbDir = path.join(__dirname, "../../sc4-plugin-manager-data")
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

interface AssetData {
  author?: string
  category?: number
  description?: string
  images?: string[]
  imageUrl?: string // TODO: Remove
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
  assets: { [assetId: string]: AssetData }
  lastModified: string
}

interface Category {
  category: number
  path: string
}

const categories: Category[] = [
  {
    category: 200,
    path: "101-residential",
  },
  {
    category: 300,
    path: "102-commercial",
  },
  {
    category: 400,
    path: "103-industrial",
  },
  {
    category: 410,
    path: "104-agricultural",
  },
  {
    category: 200,
    path: "105-building-sets",
  },
  {
    category: 600,
    path: "106-civic-non-rci",
  },
  {
    category: 500,
    path: "107-utilities",
  },
  {
    category: 660,
    path: "108-parks-plazas",
  },
  {
    category: 730,
    path: "109-waterfront",
  },
  {
    category: 700,
    path: "110-transportation",
  },
  {
    category: 710,
    path: "111-automata",
  },
  {
    category: 30,
    path: "112-gameplay-mods",
  },
  {
    category: 20,
    path: "113-graphical-mods",
  },
  {
    category: 10,
    path: "114-cheats",
  },
  {
    category: 60,
    path: "115-tools",
  },
  {
    category: 100,
    path: "118-dependencies",
  },
  {
    category: 0,
    path: "32-simpeg-plex-files",
  },
  {
    category: 0,
    path: "64-simcitypolska-files",
  },
  {
    category: 0,
    path: "67-simcitybrasil-files",
  },
  {
    category: 0,
    path: "73-workingman-productions-wmp",
  },
]

async function run(options: { minDate: string; onlyCache?: boolean }) {
  const assetsFile = path.join(dbDir, "assets/simtropolis.yaml")
  const assets = yamlParse(readFileSync(assetsFile, "utf8")) as { [assetId: string]: AssetData }

  // Load list of entries
  for (const category of categories) {
    const data = await fetchCategory(category, options)
    for (const assetId in data.assets) {
      const { imageUrl, url, ...asset } = data.assets[assetId]
      if (!asset.lastModified || asset.lastModified > options.minDate) {
        const oldData = assets[assetId]
        const newData = { ...oldData, ...asset, thumbnail: imageUrl }
        assets[assetId] = newData
        if (!newData.version || newData.lastModified !== oldData?.lastModified) {
          await fetchAssetDetails(assetId)
          const out = yamlStringify(assets, { sortMapEntries: true }).replace(/\n\S/g, "\n$&")
          writeFileSync(assetsFile, out, "utf8")
        }
      }
    }
  }

  async function fetchAssetDetails(assetId: string) {
    const asset = assets[assetId]
    const [, fileId, variant] = assetId.match(/^simtropolis[/]([\w-]+)(?:#([\w-]+))?$/)!
    const url = `${origin}/files/file/${fileId}`

    console.debug(assetId)

    console.debug(`Fetching ${url}...`)

    const html = await getHTML(url)

    asset.version = html.querySelector(".stex-title-version")?.textContent

    asset.description = html
      .querySelectorAll("article section .ipsType_richText")[0]
      ?.innerHTML.replaceAll("\u00a0", " ")
      .replaceAll("\u2013", "-")
      .replaceAll("\u2019", "'")
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

    const downloadPath = path.join(downloadsDir, `${assetId}@${asset.version}`)
    const archivePath = downloadPath + ".zip"
    const archive7zPath = downloadPath + ".7z"

    if (
      !asset.variants &&
      !existsSync(downloadPath) &&
      !existsSync(archivePath) &&
      !existsSync(archive7zPath)
    ) {
      const downloadUrl = `${url}/?do=download${variant ? `&r=${variant}` : ""}`
      console.debug(`Downloading ${downloadUrl}...`)

      const response = await get(downloadUrl, { cookies })
      const contentType = response.headers.get("Content-Type")

      if (contentType === "text/html;charset=UTF-8") {
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
      } else if (contentType === "application/x-7z-compressed") {
        const { sha256, size } = await writeFromStream(response, archive7zPath)
        asset.sha256 = sha256
        asset.size = size
      } else if (contentType === "application/zip") {
        const { sha256, size } = await writeFromStream(response, archivePath)
        asset.sha256 = sha256
        asset.size = size
      } else {
        throw Error(`Unsupported Content-Type ${contentType}`)
      }
    }

    if (asset.variants) {
      for (const variant in asset.variants) {
        const variantAssetId = `${assetId}#${variant}`
        assets[variantAssetId] = { ...asset, variantName: asset.variants[variant] }
        await fetchAssetDetails(variantAssetId)
      }
    }

    if (existsSync(archivePath)) {
      asset.uncompressed = 0

      const archive = await Open.file(archivePath)
      for (const file of archive.files) {
        if (file.type === "File") {
          asset.uncompressed += file.uncompressedSize
          console.debug(`Extracting ${file.path}`)
          const targetPath = path.join(downloadPath, file.path)
          mkdirSync(path.dirname(targetPath), { recursive: true })
          await finished(
            pipeline(file.stream(), createWriteStream(targetPath), error => {
              if (error) {
                console.error(`Failed to extract ${file.path}`, error)
              }
            }),
          )
        }
      }

      rmSync(archivePath, { recursive: true })
    }

    if (existsSync(archive7zPath)) {
      await new Promise<void>((resolve, reject) => {
        exec(`7z e "-o${downloadPath}" "${archive7zPath}"`, (error, stdout, stderr) => {
          console.debug(stdout)
          console.error(stderr)
          if (error) {
            reject(error)
          } else {
            asset.uncompressed = Number.parseInt(stdout.match(/Size:\s*(\d+)/)![1], 10)
            resolve()
          }
        })
      })

      rmSync(archive7zPath, { recursive: true })
    }

    if (asset.packageId && existsSync(downloadPath)) {
      console.error(`Creating package ${asset.packageId}...`)
      asset.uncompressed = statSync(downloadPath).size

      const authorId = asset.packageId.split("/")[0]
      const packagesFile = path.join(dbDir, `packages/${authorId}.yaml`)
      const packages: { [packageId: string]: PackageData } = existsSync(packagesFile)
        ? yamlParse(readFileSync(packagesFile, "utf8"))
        : {}

      const packageData = (packages[asset.packageId] ??= {})
      delete asset.packageId

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

      if (asset.url) {
        packageData.name = asset.url
        delete asset.url
      }

      packageData.variants ??= {}

      let variantData: VariantData
      if (asset.variantName) {
        const variantId = asset.variantName.toLowerCase().split(".")[0].replace(/\W+/g, "-")
        variantData = packageData.variants[variantId] ??= {}
        delete asset.variantName
      } else {
        variantData = packageData.variants.default ??= {}
      }

      variantData.assets = [{ id: assetId }]

      if (asset.version) {
        const [, major, minor, patch] = asset.version.match(/(\d+)(?:[.](\d+)(?:[.](\d+))?)?/)!
        variantData.version = `${major}.${minor ?? 0}.${patch ?? 0}`
      }

      const out = yamlStringify(packages, { sortMapEntries: true }).replace(/\n\S/g, "\n$&")
      writeFileSync(packagesFile, out, "utf8")
    }
  }
}

run({ minDate: "2024-06-01T00:00:00Z", onlyCache: true })

async function fetchCategory(
  category: Category,
  options: { onlyCache?: boolean } = {},
): Promise<AssetListData> {
  const assetsFile = path.join(assetsDir, `simtropolis/assets-${category.path}.json`)

  const now = new Date().toISOString()
  let lastCacheTime: string | undefined
  let data: AssetListData

  if (existsSync(assetsFile)) {
    data = JSON.parse(readFileSync(assetsFile, "utf8"))
    lastCacheTime = data.lastModified
  } else {
    data = { assets: {}, lastModified: now }
  }

  if (!lastCacheTime || !options.onlyCache) {
    let nPages: number | undefined
    let page = 1

    do {
      const url = `${origin}/files/category/${category.path}/?sortby=file_updated&sortdirection=desc&page=${page}`
      console.debug(`Page ${page} of ${nPages ?? "?"}: ${url}`)

      const html = await getHTML(url, { cookies })
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

        const asset: AssetData = {
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

    data.lastModified = now

    mkdirSync(path.dirname(assetsFile), { recursive: true })
    writeFileSync(assetsFile, JSON.stringify(data, undefined, 2), "utf8")
  }

  return data
}

async function writeFromStream(
  response: Response,
  targetPath: string,
): Promise<{ sha256: string; size: number }> {
  const hash = createHash("sha256")
  let size = 0

  const transform = new Transform({
    transform(chunk, encoding, callback) {
      hash.update(chunk)
      this.push(chunk)
      size += chunk.length
      callback()
    },
  })

  const stream = Readable.fromWeb(response.body as ReadableStream)
  mkdirSync(path.dirname(targetPath), { recursive: true })
  await finished(stream.pipe(transform).pipe(createWriteStream(targetPath)))

  const sha256 = hash.digest("hex")

  console.debug(`SHA-256: ${sha256} (${size} bytes)`)

  return { sha256, size }
}
