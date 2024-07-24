import path from "path"

import { config } from "dotenv"
import { glob } from "glob"

import { AssetData, ConfigFormat, PackageAsset, PackageData, VariantData } from "@common/types"
import { loadConfig, readConfig, writeConfig } from "@node/configs"
import { download } from "@node/download"
import { extractRecursively } from "@node/extract"
import { get } from "@node/fetch"
import { exists, getExtension, removeIfPresent } from "@node/files"

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
  exclude: [
    // TODO: Below are packages that would need more work to implement correctly
    "sc4evermore/40-nam-lite",
    "sc4evermore/41-appalachian-terrain-mod-by-lowkee33",
    "simtropolis/31248-koscs-supershk-mega-parking-for-tgn-swn",
    "simtropolis/35353-pegasus-cdk3-collection",
    "simtropolis/36257-discord-rich-presence-dll-for-simcity-4",
    // TODO: Below are external tools, not supported atm
    "sc4evermore/18-bsc-cleanitol",
    "sc4evermore/273-dgvoodoo-2-sc4-edition",
    "simtropolis/23407-gofsh-fsh-texture-editor",
    "simtropolis/27675-sc4datanode",
    "simtropolis/30033-mgb-maxis-texture-replacement-dev-kit",
    "simtropolis/32047-sc4macinjector-a-dynamic-code-plugin-loader-for-mac",
    "simtropolis/35621-simcity-4-multiplayer-project-launcher",
    "simtropolis/35790-sc4-cleanitol",
    "simtropolis/36227-dgvoodoo-2-simcity-4-edition",
    // Below are duplicate packages (available from several sources)
    "sc4evermore/278-sc4fix",
    "simtropolis/11455-dedwd-aussie-retail-series-props-vol1",
    "simtropolis/11456-dedwd-aussie-retail-series-props-vol2",
    "simtropolis/13153-bsc-mega-props-dae-vol02",
    "simtropolis/13153-dedwd-small-shop-prop-pack",
    "simtropolis/14973-bsc-mega-props-dae-vol01",
    "simtropolis/15287-bsc-mega-props-sg-vol-01-v3",
    "simtropolis/15976-rail-yard-and-spur-textures-mega-pack-1",
    "simtropolis/16098-bsc-sfbt-street-tree-mod",
    "simtropolis/22325-ncd-railyard-texture-mega-pack-vol01-v3",
    "simtropolis/26793-network-addon-mod-nam-for-windows-installer",
    "simtropolis/26793-network-addon-mod-for-windows-installer-offsite",
    "simtropolis/26808-vip-carpack-vol1",
    "simtropolis/35753-jes_resourcepack_vol27-v3",
    "simtropolis/35978-sc4moredemandinfo",
    "simtropolis/36341-sc4ltextt-sc4-ltext-translator",
    // Below are deprecated
    "simtropolis/14842-bsc-prop-pack-cycledogg-no-1",
    "simtropolis/15322-bsc-texture-pack-cycledogg-v01",
    "simtropolis/32660-pc-prop-pack-vol-1",
    "simtropolis/32732-pc-prop-pack-2",
    "simtropolis/32832-pc-towering-sign-set-1",
    "simtropolis/32879-pc-car-prop-pack",
    "simtropolis/32921-pc-hd-car-props",
  ],
  fetchEntryDetails: false,
  fetchNewEntries: false,
  include(entry) {
    return entry.lastModified >= "2024-06-01T00:00:00Z"
  },
  overrides,
  sources: [SC4EVERMORE, SIMTROPOLIS],
  superseded: {
    "sc4evermore/3-sc4d-": "sc4evermore/3-sc4d-lex-legacy-bsc-common-dependencies-pack",
    "sc4evermore/13-": "sc4evermore/13-sfbt-essentials",
    "sc4evermore/132-bsc-cp-": "sc4evermore/132-bsc-cp-mmp-for-cp-mega-prop-packs",
    "sc4evermore/278-sc4fix": "simtropolis/30883-sc4fix-third-party-patches-for-sc4",
    "simtropolis/11455-dedwd-aussie-retail-series-props-vol1":
      "sc4evermore/3-sc4d-lex-legacy-bsc-common-dependencies-pack",
    "simtropolis/11456-dedwd-aussie-retail-series-props-vol2":
      "sc4evermore/3-sc4d-lex-legacy-bsc-common-dependencies-pack",
    "simtropolis/13153-bsc-mega-props-dae-vol02":
      "sc4evermore/3-sc4d-lex-legacy-bsc-common-dependencies-pack",
    "simtropolis/13153-dedwd-small-shop-prop-pack":
      "sc4evermore/3-sc4d-lex-legacy-bsc-common-dependencies-pack",
    "simtropolis/13168-dedwd-small-shops-1x1-set":
      "sc4evermore/13168-bsc-dedwd-small-shops-1x1-set",
    "simtropolis/13169-dedwd-small-shops-1x2-set":
      "sc4evermore/13169-bsc-dedwd-small-shops-1x2-set",
    "simtropolis/13396-dedwd-small-shops-flatroof-set":
      "sc4evermore/13396-bsc-dedwd-small-shops-flat-roof-versions-set",
    "simtropolis/14973-bsc-mega-props-dae-vol01":
      "sc4evermore/3-sc4d-lex-legacy-bsc-common-dependencies-pack",
    "simtropolis/15287-bsc-mega-props-sg-vol-01":
      "sc4evermore/3-sc4d-lex-legacy-bsc-common-dependencies-pack",
    "simtropolis/15322-bsc-texture-pack-cycledogg-v01":
      "sc4evermore/3-sc4d-lex-legacy-bsc-common-dependencies-pack",
    "simtropolis/15976-rail-yard-and-spur-textures-mega-pack-1":
      "sc4evermore/246-ncd-railyard-texture-mega-pack-vol01-v3",
    "simtropolis/16098-bsc-sfbt-street-tree-mod": "sc4evermore/86-sfbt-street-tree-mod",
    "simtropolis/20966-peg-": "simtropolis/20966-peg-mtp-super-pack",
    "simtropolis/22325-ncd-railyard-texture-mega-pack-vol01-v3":
      "sc4evermore/246-ncd-railyard-texture-mega-pack-vol01-v3",
    "simtropolis/25681-murimk-props-vol01-bicycle-props-with-bikers-":
      "simtropolis/25681-murimk-props-vol01-bicycle-props-with-bikers-mmp",
    "simtropolis/25888-murimk-props-vol02": "simtropolis/25888-murimk-props-vol02-mixed-props",
    "simtropolis/26171-": "simtropolis/26171-wmp-the-bridges-of-shoreline-county",
    "simtropolis/26793-network-addon-mod-": "sc4evermore/2-network-addon-mod",
    "simtropolis/26793-network-addon-mod-nam-cross-platform": "sc4evermore/2-network-addon-mod",
    "simtropolis/26793-network-addon-mod-nam-for-windows-installer":
      "sc4evermore/2-network-addon-mod",
    "simtropolis/26793-network-addon-mod-windows-installer-offsite":
      "sc4evermore/2-network-addon-mod",
    "simtropolis/26808-vip-carpack-vol1": "sc4evermore/188-vip-vnaoned-props-pack-vol01",
    "simtropolis/31988-ncd-bsc-realrailway-texture-pack-v2":
      "simtropolis/31988-real-railway-rrw-reskin-3rd-party-lot-support",
    "simtropolis/32660-pc-prop-pack-vol-1": "simtropolis/32952-pc-mega-props-vol-1",
    "simtropolis/32732-pc-prop-pack-2": "simtropolis/32952-pc-mega-props-vol-1",
    "simtropolis/32832-pc-towering-sign-set-1": "simtropolis/32952-pc-mega-props-vol-1",
    "simtropolis/33620-wmp-essentials-v10": "simtropolis/33620-wmp-essentials-v101",
    "simtropolis/35526-pc-mega-props-4": "simtropolis/35526-pc-mega-props-42",
    "simtropolis/35526-pc-mega-props-41": "simtropolis/35526-pc-mega-props-42",
    "simtropolis/35753-jes_resourcepack_vol27-v3": "simtropolis/35753-jes_resourcepack_vol27",
    "simtropolis/35978-sc4moredemandinfo": "simtropolis/35978-sc4-more-demand-info",
  },
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

  function getDownloadUrl(entryId: string, variant?: string): string {
    return options.overrides?.[entryId]?.downloadUrl ?? getDefaultDownloadUrl(entryId, variant)
  }

  function getEntry(entryId: string): IndexerEntry | undefined {
    return entries[sourceNames[entryId]]?.assets[entryId]
  }

  function getExePath(exe: string): string {
    return process.env[`INDEXER_EXE_PATH_${exe.toUpperCase()}`] || exe
  }

  function getPackageID(entryId: string, entry: IndexerEntry, variant?: string): string {
    const entryOverrides = options.overrides?.[entryId]

    if (variant) {
      const variantOverrides = entryOverrides?.variants?.[variant]
      if (variantOverrides?.packageId) {
        return variantOverrides.packageId
      }
    }

    if (entryOverrides?.packageId) {
      return entryOverrides.packageId
    }

    return getDefaultPackageID(entryId, entry)
  }

  function getVariantID(entryId: string, entry: IndexerEntry, variant?: string): string {
    const entryOverrides = options.overrides?.[entryId]

    if (variant) {
      const variantOverrides = entryOverrides?.variants?.[variant]
      if (variantOverrides?.variantId) {
        return variantOverrides.variantId
      }
    }

    if (entryOverrides?.variantId) {
      return entryOverrides.variantId
    }

    const variantEntry = variant ? entry.variants?.[variant] : entry
    if (variantEntry?.filename) {
      if (variantEntry.filename.match(/\b(dn|dark\s?nite)\b/i)) {
        return "darknite"
      }

      if (variantEntry.filename.match(/\b(mn|maxis\s?nite)\b/i)) {
        return "default"
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

  function getSource(entryId: string): IndexerSource {
    const sourceId = sourceNames[entryId].split("/")[0]
    return options.sources.find(source => source.id === sourceId)!
  }

  const errors = new Set<string>()

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
              continue
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

  const resolvingEntries = new Set<string>()
  const resolvingPackages = new Set<string>()
  const dbAssetsConfigs = await loadAssetsFromDB()
  const dbPackagesConfigs = await loadPackagesFromDB()

  for (const entryId in sourceNames) {
    const sourceName = sourceNames[entryId]
    const sourceId = sourceName.split("/")[0]
    const entry = entries[sourceName].assets[entryId]
    if (dbAssetsConfigs[sourceId]?.[entryId] || options.include(entry, entryId)) {
      await resolveEntry(entryId)
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

    if (options.overrides?.[entryId] === null) {
      console.warn(`Skipping ${entryId}...`)
      return entry
    }

    if (options.exclude?.includes(entryId)) {
      console.warn(`Skipping ${entryId}...`)
      return entry
    }

    if (!entry) {
      errors.add(`Entry ${entryId} does not exist!`)
      return entry
    }

    console.debug(`Resolving ${entryId}...`)

    const sourceName = sourceNames[entryId]
    const sourceData = entries[sourceName]
    const source = getSource(entryId)

    const outdated = !entry.timestamp || entry.lastModified > entry.timestamp

    try {
      let wasUpdated = false

      if (outdated || !entry.version || options.fetchEntryDetails) {
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

        entry.dependencies = details.dependencies?.filter(
          dependencyId => options.superseded?.[dependencyId] ?? dependencyId !== entryId,
        )

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
        await resolveEntry(options.superseded?.[dependencyId] ?? dependencyId)
      }
    }

    return entry
  }

  async function resolveVariant(entryId: string, variant?: string): Promise<boolean> {
    const entry = getEntry(entryId)
    if (!entry) {
      errors.add(`Entry ${entryId} does not exist!`)
      return false
    }

    const assetId = getAssetID(entryId, variant)
    const downloadKey = `${assetId}@${entry.version}`
    const downloadPath = path.join(dataDownloadsDir, downloadKey)
    const downloadTempPath = path.join(dataDownloadsDir, downloadKey.replace("/", "/~"))
    const downloadUrl = getDownloadUrl(entryId, variant)
    const source = getSource(entryId)

    const variantEntry = variant ? entry.variants?.[variant] : entry
    if (!variantEntry) {
      errors.add(`Variant ${assetId} does not exist!`)
      return false
    }

    if (variant && options.overrides?.[entryId]?.variants?.[variant] === null) {
      console.warn(`Skipping ${entryId}#${variant}...`)
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

        variantEntry.files = files.map(file => file.replaceAll(path.sep, "/"))
        wasUpdated = true
      }
    }

    if (entry.version && variantEntry.files) {
      const packageId = getPackageID(entryId, entry, variant)
      const variantId = getVariantID(entryId, entry, variant)
      const authorId = packageId.split("/")[0]

      const dbPackagesConfig = dbPackagesConfigs[authorId] ?? {}
      const packageData = dbPackagesConfig[packageId] ?? {}

      if (outdated || !packageData.variants?.[variantId]) {
        const dbAssetsConfig = dbAssetsConfigs[source.id] ?? {}
        const assetData = dbAssetsConfig[assetId] ?? {}

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

        if (downloadUrl !== getDefaultDownloadUrl(entryId, variant)) {
          assetData.url = downloadUrl
        } else {
          delete assetData.url
        }

        packageData.authors ??= entry.authors
        packageData.category ??= entry.category
        packageData.name ??= entry.name
        packageData.variants ??= {}

        const dependencies = Array.from(
          new Set([
            ...(packageData.dependencies ?? []),
            ...(entry.dependencies?.map(dependencyId => {
              const dependencyEntry = getEntry(options.superseded?.[dependencyId] ?? dependencyId)
              if (dependencyEntry) {
                return getPackageID(dependencyId, dependencyEntry)
              } else {
                return dependencyId
              }
            }) ?? []),
          ]),
        ).sort()

        if (dependencies?.length) {
          packageData.dependencies = dependencies
        } else {
          delete packageData.dependencies
        }

        if (entry.description) {
          packageData.description = htmlToMd(entry.description)
        } else {
          delete packageData.description
        }

        if (entry.images?.length) {
          packageData.images = entry.images
        } else {
          delete packageData.images
        }

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
            darknite: variantId === "darknite",
          }
        }

        dbPackagesConfigs[authorId] ??= dbPackagesConfig
        dbPackagesConfig[packageId] ??= packageData
        dbAssetsConfigs[source.id] ??= dbAssetsConfig
        dbAssetsConfig[assetId] ??= assetData

        await writeConfig(dbAssetsDir, source.id, dbAssetsConfig, ConfigFormat.YAML)
        await writeConfig(dbPackagesDir, authorId, dbPackagesConfig, ConfigFormat.YAML)
      }
    } else if (!hasVariants) {
      if (entry.version) {
        errors.add(`Missing files for entry ${entryId}`)
      } else {
        errors.add(`Missing version for entry ${entryId}`)
      }
    }

    if (entry.variants && !variant) {
      for (const variant in entry.variants) {
        await resolveVariant(entryId, variant)
      }
    }

    return wasUpdated
  }
}
