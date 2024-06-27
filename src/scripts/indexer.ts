import path from "path"

import { config } from "dotenv"
import { glob } from "glob"

import { AssetData, ConfigFormat, PackageData } from "@common/types"
import { loadConfig, readConfig, writeConfig } from "@node/configs"
import { download } from "@node/download"
import { extractRecursively } from "@node/extract"
import { get } from "@node/fetch"
import { exists, getExtension } from "@node/files"

import { overrides } from "./overrides"
import { SC4EVERMORE } from "./sources/sc4evermore"
import { SIMTROPOLIS } from "./sources/simtropolis"
import {
  IndexerBaseEntry,
  IndexerEntry,
  IndexerEntryList,
  IndexerOptions,
  IndexerSource,
} from "./types"
import { readHTML, toID, wait } from "./utils"

config({ path: ".env.local" })

const now = new Date().toISOString()

const dataDir = path.join(__dirname, "data")
const dataAssetsDir = path.join(dataDir, "assets")
const dataDownloadsDir = process.env.INDEXER_DOWNLOADS_PATH!

const dbDir = path.join(__dirname, "../../sc4-plugin-manager-data")
const dbAssetsDir = path.join(dbDir, "assets")
const dbPackagesDir = path.join(dbDir, "packages")

runIndexer({
  exclude: [
    "sc4evermore/2-network-addon-mod", // TODO: Needs work
    "sc4evermore/40-nam-lite", // TODO: Needs work
    "sc4evermore/51-colossus-addon-mod-version-2-1-0-windows-by-invisichem", // TODO: Needs work
    "sc4evermore/276-colossus-addon-mod-2-5-release-candidate-1", // TODO: Fix extract
    "sc4evermore/278-sc4fix", // TODO: Use https://github.com/nsgomez/sc4fix/releases/download/rev8/SC4Fix.dll
    "simtropolis/16119-logistics-centres-megapack", // TODO: Fix .exe extract
    // TODO: Below are external tools, not supported atm
    "simtropolis/23407-gofsh-fsh-texture-editor",
    "simtropolis/27675-sc4datanode",
    "simtropolis/30033-mgb-maxis-texture-replacement-dev-kit",
    "simtropolis/31248-koscs-supershk-mega-parking-for-tgn-swn",
    "simtropolis/35790-sc4-cleanitol",
    "simtropolis/36227-dgvoodoo-2-simcity-4-edition",
  ],
  fetchEntryDetails: false,
  fetchNewEntries: false,
  include(entry) {
    return entry.lastModified >= "2024-06-01T00:00:00Z"
  },
  overrides,
  sources: [SC4EVERMORE, SIMTROPOLIS],
  superseded: {
    "simtropolis/32660-pc-prop-pack-vol-1": "simtropolis/32952-pc-mega-props-vol-1",
    "simtropolis/32732-pc-prop-pack-2": "simtropolis/32952-pc-mega-props-vol-1",
    "simtropolis/32832-pc-towering-sign-set-1": "simtropolis/32952-pc-mega-props-vol-1",
  },
})

async function loadAssetsFromDB(sources: IndexerSource[]): Promise<{
  [sourceId: string]: { [assetId: string]: AssetData }
}> {
  const configs: { [sourceId: string]: { [assetId: string]: AssetData } } = {}

  for (const source of sources) {
    console.debug(`Loading assets from ${source.id}...`)
    const config = await loadConfig<{ [assetId: string]: AssetData }>(dbAssetsDir, source.id)
    configs[source.id] = config?.data ?? {}
  }

  return configs
}

async function loadPackagesFromDB(): Promise<{
  [authorId: string]: { [packageId: string]: PackageData }
}> {
  const configs: { [authorId: string]: { [packageId: string]: PackageData } } = {}

  const filePaths = await glob("*.yaml", { cwd: dbPackagesDir, nodir: true })
  for (const filePath of filePaths) {
    const authorId = path.basename(filePath, path.extname(filePath))
    console.debug(`Loading packages from ${authorId}...`)
    const fullPath = path.join(dbPackagesDir, filePath)
    const data = await readConfig<{ [packageId: string]: PackageData }>(fullPath)
    configs[authorId] = data
  }

  return configs
}

async function runIndexer(options: IndexerOptions) {
  const sourceNames: { [entryId: string]: string } = {}
  const entries: { [sourceName: string]: IndexerEntryList } = {}

  function getAssetID(entryId: string, variant?: string): string {
    return variant ? `${entryId}#${variant}` : entryId
  }

  function getDefaultDownloadUrl(entryId: string, variant?: string): string {
    return getSource(entryId).getDownloadUrl(entryId, variant)
  }

  function getDefaultPackageID(entryId: string, entry: IndexerBaseEntry): string {
    return `${toID(entry.authors[0])}/${toID(entryId.split("/")[1].replace(/^\d+-/, ""))}`
  }

  function getDefaultVariantID(entryId: string): string {
    return options.overrides?.[entryId]?.variantId ?? "default"
  }

  function getDownloadUrl(entryId: string, variant?: string): string {
    return options.overrides?.[entryId]?.downloadUrl ?? getDefaultDownloadUrl(entryId, variant)
  }

  function getEntry(entryId: string): IndexerEntry | undefined {
    return entries[sourceNames[entryId]]?.assets[entryId]
  }

  function getExePath(exe: string): string {
    return process.env[`INDEXER_EXE_PATH_${exe.toUpperCase()}`] || exe
  }

  function getPackageID(entryId: string, entry: IndexerBaseEntry): string {
    return options.overrides?.[entryId]?.packageId ?? getDefaultPackageID(entryId, entry)
  }

  function getSource(entryId: string): IndexerSource {
    const sourceId = sourceNames[entryId].split("/")[0]
    return options.sources.find(source => source.id === sourceId)!
  }

  // Fetch asset lists
  for (const source of options.sources) {
    for (const category of source.categories) {
      const sourceName = `${source.id}/${category.id}`

      console.debug(`Loading entries from ${sourceName}...`)

      const config = await loadConfig<IndexerEntryList>(dataAssetsDir, sourceName)
      const data = { assets: config?.data.assets ?? {}, timestamp: now }
      const timestamp = config?.data.timestamp
      entries[sourceName] = data

      if (options.fetchNewEntries) {
        console.debug(`Fetching entries from ${sourceName}...`)

        let nPages: number | undefined
        let page = 1

        do {
          const url = source.getCategoryUrl(category.id, page)
          console.debug(`Page ${page} of ${nPages ?? "?"}: ${url}`)

          const html = await readHTML(await get(url, { cookies: () => source.getCookies() }))
          if (!nPages) {
            nPages = source.getCategoryPageCount(html)
          }

          const entries = source.getEntries(html)

          for (const [entryId, baseEntry] of entries) {
            // Results are sorted by last-modified-time (most recent first)
            // If we encounter any item last modified before our last cache time, we are thus done with new items
            if (source === SIMTROPOLIS && timestamp && baseEntry.lastModified < timestamp) {
              page = nPages
              break
            }

            data.assets[entryId] = {
              ...data.assets[entryId],
              ...baseEntry,
              category: category.category,
            }
          }

          // Go easy on the server
          await wait(3000)
        } while (page++ < nPages)

        await writeConfig(dataAssetsDir, sourceName, data, ConfigFormat.YAML, config?.format)
      }

      for (const entryId in data.assets) {
        sourceNames[entryId] = sourceName
      }
    }
  }

  const resolving = new Set<string>()
  const dbAssetsConfigs = await loadAssetsFromDB(options.sources)
  const dbPackagesConfigs = await loadPackagesFromDB()

  for (const entryId in sourceNames) {
    const sourceName = sourceNames[entryId]
    const sourceId = sourceName.split("/")[0]
    const entry = entries[sourceName].assets[entryId]
    if (dbAssetsConfigs[sourceId]?.[entryId] || options.include(entry)) {
      await resolveEntry(entryId)
    }
  }

  async function resolveEntry(entryId: string) {
    const entry = getEntry(entryId)

    // Handle dependency loop
    if (resolving.has(entryId)) {
      return
    }

    resolving.add(entryId)

    if (!entry) {
      console.error(`Entry ${entryId} does not exist!`)
      return
    }

    if (options.exclude?.includes(entryId)) {
      console.warn(`Skipping ${entryId}...`)
      return
    }

    console.debug(`Resolving ${entryId}...`)

    const sourceName = sourceNames[entryId]
    const sourceData = entries[sourceName]
    const source = getSource(entryId)

    const outdated = !entry.timestamp || entry.lastModified > entry.timestamp

    try {
      if (outdated || !entry.version) {
        if (!entry.version || options.fetchEntryDetails) {
          console.debug(`Fetching ${entry.url}...`)
          const html = await readHTML(await get(entry.url, { cookies: () => source.getCookies() }))
          const details = source.getEntryDetails(entryId, html)
          if (!details.version) {
            console.error(`Missing version for entry ${entryId}`)
            return
          }

          entry.description = details.description
          entry.images = details.images
          entry.repository = details.repository
          entry.version = details.version

          entry.dependencies = details.dependencies
            ?.map(dependencyId => options.superseded?.[dependencyId] ?? dependencyId)
            ?.filter(dependencyId => dependencyId !== entryId)
        }
      }

      await resolveVariant(entryId)

      entry.timestamp = now

      await writeConfig(dataAssetsDir, sourceName, sourceData, ConfigFormat.YAML)
    } catch (error) {
      // Write any progress even in case of error
      await writeConfig(dataAssetsDir, sourceName, sourceData, ConfigFormat.YAML)
      throw error
    }

    if (entry.dependencies) {
      for (const dependencyAssetId of entry.dependencies) {
        await resolveEntry(dependencyAssetId)
      }
    }
  }

  async function resolveVariant(entryId: string, variant?: string) {
    const entry = getEntry(entryId)
    if (!entry) {
      console.error(`Entry ${entryId} does not exist!`)
      return
    }

    const assetId = getAssetID(entryId, variant)
    const downloadKey = `${assetId}@${entry.version}`
    const downloadPath = path.join(dataDownloadsDir, downloadKey)
    const downloadTempPath = path.join(dataDownloadsDir, downloadKey.replace("/", "/~"))
    const downloadUrl = getDownloadUrl(entryId, variant)
    const source = getSource(entryId)

    const outdated = !entry.timestamp || entry.lastModified > entry.timestamp

    const variantEntry = variant ? entry.variants?.[variant] : entry
    if (!variantEntry) {
      console.error(`Variant ${assetId} does not exist!`)
      return
    }

    if (outdated || !variantEntry.size || !variantEntry.files) {
      let downloaded = await exists(downloadPath)

      if (!variantEntry.size || (!downloaded && !variantEntry.files)) {
        console.debug(`Downloading ${downloadUrl}...`)

        const response = await get(downloadUrl, { cookies: () => source.getCookies() })

        const contentType = response.headers.get("Content-Type")

        if (contentType?.startsWith("text/html")) {
          if (variant) {
            throw Error("Variant should not have variants")
          }

          const html = await readHTML(response)
          const variants = source.getVariants(html)

          entry.variants ??= {}
          for (const variant in variants) {
            const variantEntry = (entry.variants[variant] ??= {
              variantId: toID(variants[variant].split(".")[0]),
            })

            variantEntry.filename = variants[variant]
            await resolveVariant(entryId, variant)
          }
        } else {
          const { filename, sha256, size, uncompressedSize } = await download(response, {
            downloadPath,
            downloadTempPath,
            async exePath(exe) {
              return getExePath(exe)
            },
          })

          variantEntry.filename = filename
          variantEntry.sha256 = sha256
          variantEntry.size = size
          variantEntry.uncompressed = uncompressedSize
          downloaded = true
        }
      }

      if (downloaded) {
        console.debug(`Extracting ${downloadKey}...`)

        await extractRecursively(downloadPath, {
          async exePath(exe) {
            return getExePath(exe)
          },
        })

        const files = await glob("**", {
          cwd: downloadPath,
          nodir: true,
        })

        variantEntry.files = files.map(file => file.replaceAll(path.sep, "/"))
      }
    }

    if (variantEntry.files) {
      const variantId = variantEntry.variantId || getDefaultVariantID(entryId)
      const packageId = getPackageID(entryId, entry)
      const authorId = packageId.split("/")[0]

      const dbAssetsConfig = (dbAssetsConfigs[source.id] ??= {})
      const assetData = (dbAssetsConfig[assetId] ??= {})

      const dbPackagesConfig = (dbPackagesConfigs[authorId] ??= {})
      const packageData = (dbPackagesConfig[packageId] ??= {})

      if (outdated || !packageData.variants?.[variantId]) {
        if (packageData.variants?.[variantId]) {
          console.debug(`Updating variant ${packageId}#${variantId}...`)
        } else {
          console.debug(`Creating variant ${packageId}#${variantId}...`)
        }

        const [, major, minor, patch] = entry.version!.match(/(\d+)(?:[.](\d+)(?:[.](\d+))?)?/)!

        assetData.lastModified = entry.lastModified
        assetData.sha256 = variantEntry.sha256
        assetData.size = variantEntry.size
        assetData.uncompressed = variantEntry.uncompressed
        assetData.version = entry.version

        if (downloadUrl !== getDefaultDownloadUrl(entryId, variant)) {
          assetData.url = downloadUrl
        } else {
          assetData.url = undefined
        }

        packageData.authors ??= entry.authors
        packageData.category ??= entry.category
        packageData.description = entry.description
        packageData.name ??= entry.name
        packageData.variants ??= {}

        const dependencies = Array.from(
          new Set([
            ...(packageData.dependencies ?? []),
            ...(entry.dependencies?.map(dependencyEntryId => {
              const dependencyEntry = getEntry(dependencyEntryId)
              if (dependencyEntry) {
                return getPackageID(dependencyEntryId, dependencyEntry)
              } else {
                return dependencyEntryId
              }
            }) ?? []),
          ]),
        ).sort()

        packageData.images = entry.images?.length ? entry.images : undefined
        packageData.dependencies = dependencies.length ? dependencies : undefined
        packageData.repository = entry.repository
        packageData.thumbnail = entry.thumbnail
        packageData.url = entry.url

        const variantData = (packageData.variants[variantId] ??= {})

        variantData.assets ??= []
        variantData.version = `${major}.${minor ?? 0}.${patch ?? 0}`

        let variantAsset = variantData.assets.find(variantAsset => variantAsset.id === assetId)

        if (!variantAsset) {
          variantAsset = { id: assetId }
          variantData.assets.push(variantAsset)
        }

        const sc4Extensions = [
          ".dat",
          ".dll",
          ".ini",
          "._loosedesc",
          ".sc4desc",
          ".sc4lot",
          ".sc4model",
        ]

        variantAsset.docs = variantEntry.files.filter(
          file => !sc4Extensions.includes(getExtension(file)),
        )

        variantAsset.include = variantEntry.files.filter(file =>
          sc4Extensions.includes(getExtension(file)),
        )

        if (entry.category >= 200 && entry.category < 800 && entry.category !== 660) {
          packageData.warnings ??= [{ id: "bulldoze", on: "disable" }]
          variantData.requirements ??= {
            darknite: !!variant?.match(/dark.?nig?th?e?|\bdn\b/i),
          }
        }
      }

      await writeConfig(dbAssetsDir, source.id, dbAssetsConfig, ConfigFormat.YAML)
      await writeConfig(dbPackagesDir, authorId, dbPackagesConfig, ConfigFormat.YAML)
    }
  }
}
