import path from "path"

import { config } from "dotenv"
import { glob } from "glob"

import { AssetData, AssetID } from "@common/assets"
import { ConfigFormat, LotData, PackageAsset, PackageData, VariantData } from "@common/types"
import { loadConfig, readConfig, writeConfig } from "@node/configs"
import { download } from "@node/download"
import { extractRecursively } from "@node/extract"
import { get } from "@node/fetch"
import { exists, getExtension, removeIfPresent } from "@node/files"

import { OVERRIDES } from "./overrides"
import { SC4EVERMORE } from "./sources/sc4evermore"
import { SIMTROPOLIS } from "./sources/simtropolis"
import {
  IndexerBaseEntry,
  IndexerCategory,
  IndexerEntry,
  IndexerEntryList,
  IndexerOptions,
  IndexerOverride,
  IndexerSource,
} from "./types"
import { htmlToMd, readHTML, toID, wait } from "./utils"

config({ path: ".env.local" })

const now = new Date().toISOString()

const dataDir = path.join(__dirname, "data")
const dataAssetsDir = path.join(dataDir, "assets")
const dataDownloadsDir = process.env.INDEXER_DOWNLOADS_PATH!

const dbDir = path.join(__dirname, "../../sc4-plugin-manager-data")
const dbAssetsDir = path.join(dbDir, "assets")
const dbPackagesDir = path.join(dbDir, "packages")

runIndexer({
  fetchEntryDetails() {
    return false
  },
  fetchNewEntries(data) {
    if (data?.timestamp) {
      const hour = 60 * 60 * 1000
      return Date.now() >= new Date(data.timestamp).getTime() + 6 * hour
    }

    return true
  },
  include(entry, entryId, source, category) {
    return (
      (entry.lastModified >= "2024-05-01T00:00:00Z" && !category.id.includes("obsolete")) ||
      [
        "167-bsc-aln-rrp-pasture-flora",
        "234-ksteam-s54-prop-pack-vol01",
        "19953-orange-megaprop-v01",
      ].some(id => entryId.includes(id))
    )
  },
  overrides: OVERRIDES,
  sources: [SC4EVERMORE, SIMTROPOLIS],
})

async function loadAssetsFromDB(): Promise<{
  [sourceId: string]: { [assetId: string]: AssetData }
}> {
  const configs: { [sourceId: string]: { [assetId: string]: AssetData } } = {}

  const filePaths = await glob("*.yaml", { cwd: dbAssetsDir })
  for (const filePath of filePaths) {
    const sourceId = path.basename(filePath, path.extname(filePath))
    console.debug(`Loading assets from ${sourceId}...`)
    const config = await loadConfig<{ [assetId: string]: AssetData }>(dbAssetsDir, sourceId)
    configs[sourceId] = config?.data ?? {}
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

    // for (const packageData of Object.values(data)) {
    //   for (const variantData of [packageData, ...Object.values(packageData.variants ?? {})]) {
    //     const filenames: string[] = []
    //     if (variantData.assets) {
    //       for (const asset of variantData.assets) {
    //         const sc4lotFiles = await glob(asset.id + "@*/**/*.sc4lot", {
    //           cwd: dataDownloadsDir,
    //           nodir: true,
    //         })

    //         for (const sc4lotFile of sc4lotFiles) {
    //           filenames.push(path.basename(sc4lotFile))
    //         }
    //       }
    //     }

    //     if (variantData.lots) {
    //       for (const lot of variantData.lots) {
    //         if (lot.id && !lot.filename) {
    //           lot.filename = filenames.find(filename => filename.includes(lot.id!))
    //           lot.id = lot.filename?.match(/_([a-f0-9]{8})\.sc4lot$/i)?.[1].toLowerCase()
    //         }
    //       }
    //     }
    //   }
    // }

    // await writeConfig(dbPackagesDir, authorId, data, ConfigFormat.YAML, ConfigFormat.YAML)
  }

  return configs
}

async function runIndexer(options: IndexerOptions) {
  const assetIds: { [sourceId: string]: { [entryId: number]: string } } = {}
  const assets: { [assetId: string]: IndexerEntry } = {}
  const sourceFiles: { [sourceName: string]: IndexerEntryList } = {}
  const sourceNames: { [assetId: string]: string } = {}

  const sources: { [sourceId: string]: IndexerSource } = {}
  for (const source of options.sources) {
    sources[source.id] = source
  }

  function getCategory(assetId: string): IndexerCategory {
    const [sourceId, categoryId] = sourceNames[assetId].split("/")
    return sources[sourceId].categories.find(category => category.id === categoryId)!
  }

  function getDefaultDownloadUrl(assetId: string, variant?: string): string {
    return getSource(assetId).getDownloadUrl(assetId, variant)
  }

  function getDefaultPackageID(assetId: string, entry: IndexerBaseEntry): string {
    return `${toID(entry.authors[0])}/${toID(assetId.split("/")[1].replace(/^\d+-/, ""))}`
  }

  function getDependencyAssetID(originalAssetId: string): string {
    const sourceId = getSourceID(originalAssetId)
    const entryId = getEntryID(originalAssetId)
    const assetId = assetIds[sourceId][entryId] ?? originalAssetId
    return getOverrides(assetId)?.superseded ?? assetId
  }

  function getDownloadUrl(assetId: string, variant?: string): string {
    const overrides = getOverrides(assetId, variant)

    if (overrides?.downloadUrl) {
      return overrides.downloadUrl
    }

    return getDefaultDownloadUrl(assetId, variant)
  }

  function getEntry(assetId: string): IndexerEntry | undefined {
    return assets[assetId]
  }

  function getEntryID(assetId: string): number {
    return Number(assetId.split("/")[1].split("-")[0])
  }

  function getExePath(exe: string): string {
    return process.env[`INDEXER_EXE_PATH_${exe.toUpperCase()}`] || exe
  }

  function getPackageID(assetId: string, entry: IndexerEntry, variant?: string): string {
    const overrides = getOverrides(assetId, variant)

    if (overrides?.packageId) {
      return overrides.packageId
    }

    return getDefaultPackageID(assetId, entry)
  }

  function getSource(assetId: string): IndexerSource {
    return sources[getSourceID(assetId)]
  }

  function getSourceID(assetId: string): string {
    return assetId.split("/")[0]
  }

  function getVariantAssetID(assetId: string, variant?: string): AssetID {
    return (variant ? `${assetId}#${variant}` : assetId) as AssetID
  }

  function getVariantID(assetId: string, entry: IndexerEntry, variant?: string): string {
    const overrides = getOverrides(assetId, variant)

    if (overrides?.variantId) {
      return overrides.variantId
    }

    const variantEntry = variant ? entry.variants?.[variant] : entry
    if (variantEntry?.filename) {
      if (variantEntry.filename.match(/\b(dn|dark\s?nite)\b/i)) {
        return "darknite"
      }

      if (variantEntry.filename.match(/\b(mn|maxis\s?nite)\b/i)) {
        return "default"
      }

      if (variant && variantEntry.filename.match(/\b(rhd)\b/i)) {
        return "rhd"
      }

      if (variant && variantEntry.filename.match(/\b(hd)\b/i)) {
        return "hd"
      }

      if (variant) {
        return toID(variantEntry.filename.split(".").slice(0, -1).join("."))
      }
    }

    return "default"
  }

  function getOverrides(assetId: string, variant?: string): IndexerOverride | null | undefined {
    const overrides = options.overrides?.[getSourceID(assetId)]?.[getEntryID(assetId)]

    if (variant && overrides?.variants) {
      const variantOverrides = overrides.variants[variant]
      if (variantOverrides === null) {
        return null
      }

      if (variantOverrides !== undefined) {
        return { ...overrides, ...variantOverrides }
      }
    }

    return overrides
  }

  const errors = new Set<string>()

  // Fetch asset lists
  for (const source of options.sources) {
    const sourceId = source.id
    assetIds[sourceId] = {}

    for (const category of source.categories) {
      const sourceName = `${sourceId}/${category.id}`

      console.debug(`Loading entries from ${sourceName}...`)

      const config = await loadConfig<IndexerEntryList>(dataAssetsDir, sourceName)
      const data = { assets: config?.data.assets ?? {}, timestamp: now }
      const timestamp = config?.data.timestamp
      sourceFiles[sourceName] = data

      for (const assetId in data.assets) {
        const entryId = getEntryID(assetId)
        assetIds[sourceId][entryId] = assetId
      }

      if (options.fetchNewEntries?.(config?.data, source, category)) {
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

          for (const [assetId, baseEntry] of entries) {
            // Results are sorted by last-modified-time (most recent first)
            // If we encounter any item last modified before our last cache time, we are thus done with new items
            if (source === SIMTROPOLIS && timestamp && baseEntry.lastModified < timestamp) {
              page = nPages
              continue
            }

            const entryId = getEntryID(assetId)

            assetIds[sourceId][entryId] = assetId

            data.assets[assetId] = {
              ...data.assets[assetId],
              ...baseEntry,
              category: category.category,
            }
          }

          // Go easy on the server
          await wait(3000)
        } while (page++ < nPages)

        await writeConfig(dataAssetsDir, sourceName, data, ConfigFormat.YAML, config?.format)
      }

      for (const assetId in data.assets) {
        assets[assetId] = data.assets[assetId]
        sourceNames[assetId] = sourceName
      }
    }
  }

  const resolvingEntries = new Set<string>()
  const resolvingPackages = new Set<string>()
  const dbAssetsConfigs = await loadAssetsFromDB()
  const dbPackagesConfigs = await loadPackagesFromDB()

  for (const assetId in assets) {
    const entry = assets[assetId]
    const sourceId = getSourceID(assetId)
    if (
      dbAssetsConfigs[sourceId]?.[assetId] ||
      options.include(entry, assetId, getSource(assetId), getCategory(assetId))
    ) {
      await resolveEntry(assetId)
    }
  }

  for (const authorId in dbPackagesConfigs) {
    for (const packageId in dbPackagesConfigs[authorId]) {
      const packageData = dbPackagesConfigs[authorId][packageId]
      await resolvePackage(packageId, packageData)
    }
  }

  async function resolvePackageAsset(
    packageId: string,
    variantId: string | undefined,
    asset: PackageAsset,
  ) {
    const sourceId = asset.id.split("/")[0]
    if (!dbAssetsConfigs[sourceId]?.[asset.id]) {
      const [entryId, variant] = asset.id.split("#")
      const entry = await resolveEntry(entryId)
      if (!entry || (variant && !entry.variants?.[variant])) {
        errors.add(
          variantId
            ? `In variant ${packageId}#${variantId} - Entry ${entryId} does not exist`
            : `In package ${packageId} - Entry ${entryId} does not exist`,
        )
      }
    }
  }

  async function resolvePackageVariant(
    packageId: string,
    variantId: string | undefined,
    variantData: VariantData,
  ) {
    if (variantData.assets) {
      for (const asset of variantData.assets) {
        await resolvePackageAsset(packageId, variantId, asset)
      }
    }

    if (variantData.dependencies) {
      for (const dependencyId of variantData.dependencies) {
        const authorId = dependencyId.split("/")[0]
        const dependencyData = dbPackagesConfigs[authorId]?.[dependencyId]
        if (dependencyData) {
          await resolvePackage(dependencyId, dependencyData)
        } else {
          errors.add(
            variantId
              ? `In variant ${packageId}#${variantId} - Package ${dependencyId} does not exist`
              : `In package ${packageId} - Package ${dependencyId} does not exist`,
          )
        }
      }
    }
  }

  async function resolvePackage(packageId: string, packageData: PackageData) {
    // Handle dependency loop
    if (resolvingPackages.has(packageId)) {
      return
    }

    resolvingPackages.add(packageId)

    await resolvePackageVariant(packageId, undefined, packageData)

    if (packageData.variants) {
      for (const variantId in packageData.variants) {
        const variantData = packageData.variants[variantId]
        await resolvePackageVariant(packageId, variantId, variantData)
      }
    }
  }

  // Show errors
  if (errors.size) {
    const n = 100
    console.error("".padEnd(n, "*"))
    console.error(`* ${"ERRORS".padStart((n + 6 - 4) / 2, " ").padEnd(n - 4, " ")} *`)
    console.error("".padEnd(n, "*"))
    for (const error of errors) {
      console.error(error)
      console.error("---")
    }
  }

  async function resolveEntry(entryId: string): Promise<IndexerEntry | undefined> {
    const entry = getEntry(entryId)

    // Handle dependency loop
    if (resolvingEntries.has(entryId)) {
      return entry
    }

    resolvingEntries.add(entryId)

    const overrides = getOverrides(entryId)

    if (overrides === null) {
      console.warn(`Skipping ${entryId}...`)
      return entry
    }

    if (overrides?.superseded) {
      return resolveEntry(overrides.superseded)
    }

    if (!entry) {
      errors.add(`Entry ${entryId} does not exist!`)
      return entry
    }

    console.debug(`Resolving ${entryId}...`)

    const sourceName = sourceNames[entryId]
    const sourceData = sourceFiles[sourceName]
    const source = getSource(entryId)

    const outdated = !entry.timestamp || entry.lastModified > entry.timestamp

    try {
      let wasUpdated = false

      if (outdated || !entry.version || options.fetchEntryDetails?.(entry, entryId)) {
        console.debug(`Fetching ${entry.url}...`)
        const html = await readHTML(await get(entry.url, { cookies: () => source.getCookies() }))
        const details = source.getEntryDetails(entryId, html)
        if (!details.version) {
          errors.add(`Missing version for entry ${entryId}`)
          return entry
        }

        entry.description = details.description
        entry.images = details.images
        entry.repository = details.repository
        entry.version = details.version

        entry.dependencies = details.dependencies
          ?.map(getDependencyAssetID)
          ?.filter(dependencyId => dependencyId !== entryId)

        wasUpdated = true
      }

      if (await resolveVariant(entryId)) {
        wasUpdated = true
      }

      if (wasUpdated) {
        entry.timestamp = now
        await writeConfig(dataAssetsDir, sourceName, sourceData, ConfigFormat.YAML)
      }
    } catch (error) {
      // Write any progress even in case of error
      await writeConfig(dataAssetsDir, sourceName, sourceData, ConfigFormat.YAML)
      throw error
    }

    if (entry.dependencies) {
      for (const dependencyId of entry.dependencies) {
        await resolveEntry(dependencyId)
      }
    }

    return entry
  }

  async function resolveVariant(assetId: string, variant?: string): Promise<boolean> {
    const entry = getEntry(assetId)
    if (!entry) {
      errors.add(`Entry ${assetId} does not exist!`)
      return false
    }

    const variantAssetId = getVariantAssetID(assetId, variant)
    const downloadKey = `${variantAssetId}@${entry.version}`
    const downloadPath = path.join(dataDownloadsDir, downloadKey)
    const downloadTempPath = path.join(dataDownloadsDir, downloadKey.replace("/", "/~"))
    const downloadUrl = getDownloadUrl(assetId, variant)
    const source = getSource(assetId)

    const variantEntry = variant ? entry.variants?.[variant] : entry
    if (!variantEntry) {
      errors.add(`Variant ${variantAssetId} does not exist!`)
      return false
    }

    if (getOverrides(assetId, variant) === null) {
      console.warn(`Skipping ${variantAssetId}...`)
      return false
    }

    const outdated = !entry.timestamp || entry.lastModified > entry.timestamp
    const hasVariants = !variant && !!entry.variants
    const missingSize = !variantEntry.size && !hasVariants
    const missingFiles = !variantEntry.files && !hasVariants

    let wasUpdated = false

    if (outdated || missingSize || missingFiles) {
      let downloaded = await exists(downloadPath)

      if (missingSize || (outdated && !missingFiles) || (missingFiles && !downloaded)) {
        await removeIfPresent(downloadPath)

        console.debug(`Downloading ${downloadUrl}...`)

        const response = await get(downloadUrl, { cookies: () => source.getCookies() })

        const contentType = response.headers.get("Content-Type")

        if (contentType?.startsWith("text/html")) {
          if (variant) {
            throw Error("Variant should not have variants")
          }

          const html = await readHTML(response)
          const variants = source.getVariants(html)

          delete entry.filename
          delete entry.files
          delete entry.sha256
          delete entry.size
          delete entry.uncompressed
          entry.variants ??= {}
          for (const variant in variants) {
            const variantEntry = (entry.variants[variant] ??= {})
            variantEntry.filename = variants[variant]
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
          wasUpdated = true
          downloaded = true

          if (!variant) {
            delete entry.variants
          }
        }
      }

      if ((outdated || missingFiles) && downloaded) {
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

        variantEntry.files = files.map(file => file.replaceAll(path.sep, "/")).reverse()
        wasUpdated = true
      }
    }

    if (entry.version && variantEntry.files) {
      const packageId = getPackageID(assetId, entry, variant)
      const variantId = getVariantID(assetId, entry, variant)
      const authorId = packageId.split("/")[0]

      const dbPackagesConfig = dbPackagesConfigs[authorId] ?? {}
      const packageData = dbPackagesConfig[packageId] ?? {}

      if (outdated || !packageData.variants?.[variantId]) {
        const dbAssetsConfig = dbAssetsConfigs[source.id] ?? {}
        const assetData = dbAssetsConfig[variantAssetId] ?? {}

        if (packageData.variants?.[variantId]) {
          console.debug(`Updating variant ${packageId}#${variantId}...`)
        } else {
          console.debug(`Creating variant ${packageId}#${variantId}...`)
        }

        const [, major, minor, patch] = entry.version.match(/(\d+)(?:[.](\d+)(?:[.](\d+))?)?/)!

        assetData.lastModified = entry.lastModified
        assetData.sha256 = variantEntry.sha256
        assetData.size = variantEntry.size
        assetData.uncompressed = variantEntry.uncompressed
        assetData.version = entry.version

        if (downloadUrl !== getDefaultDownloadUrl(assetId, variant)) {
          assetData.url = downloadUrl
        } else {
          delete assetData.url
        }

        packageData.category ??= entry.category
        packageData.name ??= entry.name
        packageData.release ??= now
        packageData.variants ??= {}

        const variantData = (packageData.variants[variantId] ??= {})

        const dependencies = Array.from(
          new Set([
            ...(packageData.dependencies ?? []),
            ...(variantData.dependencies ?? []),
            ...(entry.dependencies?.map(dependencyId => {
              const dependencyEntry = getEntry(dependencyId)
              if (dependencyEntry) {
                return getPackageID(dependencyId, dependencyEntry)
              } else {
                return dependencyId
              }
            }) ?? []),
          ]),
        ).sort()

        const deprecated = getCategory(assetId).id.includes("obsolete")

        if (variantId === "default") {
          packageData.authors ??= entry.authors

          if (dependencies?.length) {
            packageData.dependencies = dependencies
          }

          if (deprecated) {
            packageData.deprecated = true
          }

          if (entry.description) {
            packageData.description = htmlToMd(entry.description)
          }

          if (entry.images?.length) {
            packageData.images = entry.images
          }

          packageData.repository = entry.repository
          packageData.thumbnail = entry.thumbnail
          packageData.url = entry.url

          variantData.name = "Default"
        } else {
          const authors = entry.authors.filter(author => !packageData.authors?.includes(author))
          if (authors.length) {
            variantData.authors ??= authors
          }

          if (deprecated) {
            variantData.deprecated = true
          }

          if (packageData.release !== now) {
            variantData.release = now
          }

          if (entry.repository) {
            packageData.repository ??= entry.repository
            if (packageData.repository !== entry.repository) {
              variantData.repository = entry.repository
            }
          }

          if (entry.thumbnail) {
            packageData.thumbnail ??= entry.thumbnail
            if (packageData.thumbnail !== entry.thumbnail) {
              variantData.thumbnail = entry.thumbnail
            }
          }

          if (entry.url) {
            packageData.url ??= entry.url
            if (packageData.url !== entry.url) {
              variantData.url = entry.url

              if (dependencies.length) {
                variantData.dependencies = dependencies.filter(
                  id => !packageData.dependencies?.includes(id),
                )
              }

              if (entry.description) {
                variantData.description = htmlToMd(entry.description)
              }

              if (entry.images?.length) {
                variantData.images = entry.images
              }
            } else {
              if (dependencies?.length) {
                packageData.dependencies = dependencies
              }

              if (entry.description) {
                packageData.description = htmlToMd(entry.description)
              }

              if (entry.images?.length) {
                packageData.images = entry.images
              }
            }
          }

          variantData.name = {
            darknite: "Dark Nite",
            lhd: "Left-Hand Drive",
            hd: "HD",
            rhd: "Right-Hand Drive",
            sd: "SD",
          }[variantId]

          variantData.name ?? entry.name
        }

        variantData.assets ??= []
        variantData.version = `${major}.${minor ?? 0}.${patch ?? 0}`

        let variantAsset = variantData.assets.find(
          variantAsset => variantAsset.id === variantAssetId,
        )

        if (!variantAsset) {
          variantAsset = { id: variantAssetId }
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

        const sc4Files = variantEntry.files.filter(file =>
          sc4Extensions.includes(getExtension(file)),
        )

        const lots: { [lotId: string]: LotData } = {}
        for (const file of sc4Files) {
          const filename = file.match(/([^\\/]+)\.sc4lot$/i)?.[1]
          if (filename) {
            const size = filename.match(/[-_ ](\d+x\d+)[-_ ]/i)?.[1]
            const stage = filename.match(/((?:R|CO|CS)\$+|\bI-?(?:D|M|HT)\$*)(\d+)[-_ ]/i)?.[2]

            const kind =
              filename
                .match(/(PLOP|(?:R|CO|CS)\$+|\bI-?(?:D|M|HT))[^a-z]/i)?.[1]
                .replace("-", "")
                .toLowerCase() ?? ""

            const category: string | undefined = {
              co$$: "co$$",
              co$$$: "co$$$",
              cs$: "cs$",
              cs$$: "cs$$",
              cs$$$: "cs$$$",
              id: "i-d",
              iht: "i-ht",
              im: "i-m",
              plop: "landmarks",
              r$: "r$",
              r$$: "r$$",
              r$$$: "r$$$",
            }[kind]

            lots[filename] = {
              category: category && category !== packageData.category ? category : undefined,
              filename,
              id: filename.match(/_([a-f0-9]{8})\.sc4lot$/i)?.[1].toLowerCase() ?? filename,
              label: filename,
              requirements: file.match(/\bCAM\b/i) ? { cam: true } : undefined,
              size: size as `${number}x${number}`,
              stage: stage ? Number.parseInt(stage) : undefined,
            }
          }
        }

        if (Object.values(lots).length) {
          variantData.lots = Object.values(lots)
          packageData.warnings ??= [{ id: "bulldoze", on: "disable" }]
        } else {
          variantAsset.include = sc4Files
        }

        dbPackagesConfigs[authorId] ??= dbPackagesConfig
        dbPackagesConfig[packageId] ??= packageData
        dbAssetsConfigs[source.id] ??= dbAssetsConfig
        dbAssetsConfig[variantAssetId] ??= assetData

        await writeConfig(dbAssetsDir, source.id, dbAssetsConfig, ConfigFormat.YAML)
        await writeConfig(dbPackagesDir, authorId, dbPackagesConfig, ConfigFormat.YAML)
      }
    } else if (!hasVariants) {
      if (entry.version) {
        errors.add(`Missing files for entry ${assetId}`)
      } else {
        errors.add(`Missing version for entry ${assetId}`)
      }
    }

    if (entry.variants && !variant) {
      for (const variant in entry.variants) {
        await resolveVariant(assetId, variant)
      }
    }

    return wasUpdated
  }
}
