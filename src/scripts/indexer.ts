import { readdir } from "node:fs/promises"
import path from "node:path"

import { input, select } from "@inquirer/prompts"
import {
  ID,
  forEach,
  forEachAsync,
  generate,
  getRequired,
  indexBy,
  isEmpty,
  isEqual,
  isString,
  keys,
  mapDefined,
  mapValues,
  parseHex,
  remove,
  unique,
  values,
} from "@salinco/nice-utils"
import { config } from "dotenv"
import { glob } from "glob"

import type { AssetData, AssetID } from "@common/assets"
import type { AuthorData, AuthorID } from "@common/authors"
import {
  type ExemplarPropertyData,
  type ExemplarPropertyInfo,
  ExemplarValueType,
} from "@common/exemplars"
import { type PackageID, getOwnerId } from "@common/packages"
import { ConfigFormat, type PackageData, type PackageFile } from "@common/types"
import { globToRegex } from "@common/utils/glob"
import { parseStringArray } from "@common/utils/types"
import type { VariantData, VariantID } from "@common/variants"
import { loadConfig, readConfig, writeConfig } from "@node/configs"
import { download } from "@node/download"
import { extractRecursively } from "@node/extract"
import { get } from "@node/fetch"
import { exists, removeIfPresent } from "@node/files"

import type { BuildingData } from "@common/buildings"
import type { LotData } from "@common/lots"
import { type SC4FileData, analyzeSC4Files } from "./dbpf/dbpf"
import { writePackageData } from "./dbpf/packages"
import {
  promptAuthorName,
  promptPackageId,
  promptUrl,
  promptVariantId,
  promptYesNo,
} from "./prompt"
import { SC4EVERMORE } from "./sources/sc4evermore"
import { SIMTROPOLIS } from "./sources/simtropolis"
import type {
  EntryID,
  IndexerEntry,
  IndexerEntryList,
  IndexerOptions,
  IndexerOverride,
  IndexerSource,
  IndexerSourceCategoryID,
  IndexerSourceID,
  IndexerVariantEntry,
} from "./types"
import { getEnvRequired, readHTML, toID, wait } from "./utils"

config({ path: ".env.local" })

const UNCATEGORIZED: IndexerSourceCategoryID = ID("uncategorized")

const now = new Date()

const dataDir = path.join(__dirname, "data")
const dataAssetsDir = path.join(dataDir, "assets")
const dataDownloadsDir = getEnvRequired("INDEXER_DOWNLOADS_PATH")
const dataDownloadsTempDir = getEnvRequired("INDEXER_DOWNLOADS_TEMP_PATH")
const gameDir = getEnvRequired("INDEXER_GAME_PATH")
;("D:\\Program Files (x86)\\Steam\\steamapps\\common\\SimCity 4 Deluxe")
const dbDir = path.join(__dirname, "../../sc4-plugin-manager-data")
const dbAssetsDir = path.join(dbDir, "assets")
const dbPackagesDir = path.join(dbDir, "packages")

runIndexer({
  include: {
    authors: ["buggi", "cococity", "memo", "null-45", "simmaster07", "toroca"],
    entries: [
      "simtropolis/13318",
      "simtropolis/15758",
      "simtropolis/21339",
      "simtropolis/22771",
      "simtropolis/23089",
      "simtropolis/27340",
      "simtropolis/30836",
    ],
  },
  migrate: {
    entries(entry, entryId) {
      return false
    },
  },
  refetchIntervalHours: 300,
  sources: [SC4EVERMORE, SIMTROPOLIS],
  version: 1,
})

async function runIndexer(options: IndexerOptions): Promise<void> {
  const sources = indexBy(options.sources, source => source.id)

  const errors = new Set<string>()

  const assetIds: { [entryId in EntryID]?: AssetID } = {}
  const entries: { [entryId in EntryID]?: IndexerEntry } = {}

  const categories: {
    [sourceId in IndexerSourceID]: {
      [categoryId in IndexerSourceCategoryID]: IndexerEntryList
    }
  } = {}

  function getAssetID(entryId: EntryID, hint?: string): AssetID {
    assetIds[entryId] ??= (hint ?? entryId) as AssetID
    return assetIds[entryId]
  }

  function getEntry(entryId: EntryID): IndexerEntry {
    return getRequired(entries, entryId)
  }

  function getOverride(entryId: EntryID, variant?: string): IndexerOverride | null | undefined {
    const override = overrides[entryId]
    return variant ? override?.variants?.[variant] : override
  }

  function getSource(entryId: EntryID): IndexerSource | undefined {
    return sources[getSourceId(entryId)]
  }

  const skipped = new Set<EntryID>()
  const overrides = await loadOverrides()

  const dbAuthors = await loadAuthorsFromDB()
  const dbAssetsConfigs = await loadAssetsFromDB()
  const dbPackagesConfigs = await loadPackagesFromDB()
  const exemplarProperties = await loadExemplarProperties()

  // Step 1a - Load existing categorized entries
  for (const source of options.sources) {
    for (const category of values(source.categories)) {
      console.debug(`Loading entries from ${source.id}/${category.id}...`)

      const data = await loadEntries(source.id, category.id)

      let migrated = false
      forEach(data.assets, (entry, entryId) => {
        migrated = options.migrate?.entries?.(entry, entryId) || migrated
        assetIds[entryId] = entry.assetId
        entries[entryId] = entry
      })

      if (migrated) {
        await writeEntries(source.id, category.id)
      }
    }
  }

  // Step 1b - Load existing uncategorized entries
  for (const child of await readdir(dataAssetsDir, { withFileTypes: true })) {
    if (child.isDirectory()) {
      const sourceId = child.name as IndexerSourceID
      console.debug(`Loading entries from ${sourceId}...`)
      const data = await loadEntries(sourceId)

      let migrated = false
      forEach(data.assets, (entry, entryId) => {
        migrated = options.migrate?.entries?.(entry, entryId) || migrated
        assetIds[entryId] = entry.assetId
        entries[entryId] = entry
      })

      if (migrated) {
        await writeEntries(sourceId)
      }
    }
  }

  // Step 1d - Create entries
  await forEachAsync(dbAssetsConfigs, async (assets, sourceId) => {
    categories[sourceId] ??= {}
    categories[sourceId][UNCATEGORIZED] ??= { assets: {} }
    const data = categories[sourceId][UNCATEGORIZED]

    forEach(assets, (asset, assetId) => {
      const entryId = getEntryId(assetId)
      if (asset.url && asset.version && !entries[entryId]) {
        console.debug(`Creating entry ${entryId} from asset ${assetId}...`)

        // GitHub asset IDs with format github/[user]/[repo]
        const githubUserId = entryId.match(/^github[/]([^/]+)[/][^/]+$/)?.[1]

        assetIds[entryId] = assetId

        entries[entryId] = {
          assetId,
          authors: githubUserId ? [githubUserId] : undefined,
          download: asset.url,
          lastModified: asset.lastModified ?? now,
          version: String(asset.version),
        }

        data.assets[entryId] = entries[entryId]
      }
    })

    if (!isEmpty(data.assets)) {
      data.meta ??= {}

      if (shouldRefreshEntryList(data)) {
        if (sourceId === "github") {
          await forEachAsync(data.assets, async (entry, entryId) => {
            const repository =
              entry.download?.match(/^https:[/][/]github[.]com[/]([^/]+[/][^/]+)/)?.[1] ??
              entry.repository?.match(/^https:[/][/]github[.]com[/]([^/]+[/][^/]+)/)?.[1] ??
              entryId.match(/^github[/]([^/]+[/][^/]+)$/)?.[1]

            if (repository) {
              entry.repository = `https://github.com/${repository}`

              const url = `https://api.github.com/repos/${repository}/releases/latest`

              try {
                console.debug(`Fetching ${url}...`)

                const res = await get(url, {})
                const latest = (await res.json()) as {
                  assets: {
                    browser_download_url: string
                    created_at: string
                    name: string
                    size: number
                    updated_at: string
                  }[]
                  created_at: string
                  name: string
                  published_at: string
                  tag_name: string
                }

                const version = latest.tag_name.replace(/^v/i, "") // remove leading v
                const assetName = entry.download?.split("/").at(-1)?.replace("{version}", version)
                const asset = latest.assets.find(asset => asset.name === assetName)

                if (asset && (!entry.download || entry.version !== version)) {
                  entry.download = asset.browser_download_url.replaceAll(version, "{version}")
                  entry.filename = asset.name
                  entry.files = undefined
                  entry.lastModified = new Date(asset.updated_at)
                  entry.sha256 = undefined
                  entry.size = undefined
                  entry.uncompressed = undefined
                  entry.version = version
                }

                await wait(3000)
              } catch (error) {
                console.error(`Failed to fetch ${url}`, error)
                errors.add(`Failed to fetch ${url}`)
              }
            }
          })
        }

        data.meta.timestamp = now
      }

      await writeEntries(sourceId)
    }
  })

  // Step 2 - Fetch new entries
  for (const source of options.sources) {
    for (const category of values(source.categories)) {
      const data = categories[source.id][category.id]
      const timestamp = data.meta?.timestamp

      // Check whether to refetch asset listing for this category
      if (shouldRefreshEntryList(data)) {
        console.debug(`Fetching entries from ${source.id}/${category.id}...`)

        let nPages: number | undefined
        let page = 1

        do {
          const url = source.getCategoryUrl(category.id, page)
          console.debug(`Page ${page} of ${nPages ?? "?"}: ${url}`)

          const html = await readHTML(await get(url, { cookies: () => source.getCookies() }))

          nPages ??= source.getCategoryPageCount(html)

          const baseEntries = source.getEntries(html)

          for (const baseEntry of baseEntries) {
            // Results are sorted by last-modified-time (most recent first)
            // If we encounter any item last modified before our last cache time, we are thus done with new items
            if (source === SIMTROPOLIS && timestamp && baseEntry.lastModified < timestamp) {
              page = nPages
              continue
            }

            const entryId = getEntryId(baseEntry.assetId)

            const entry: IndexerEntry = {
              ...entries[entryId],
              ...baseEntry,
              // Preserve existing assetId not to break references
              assetId: getAssetID(entryId, baseEntry.assetId),
              category: category.id,
            }

            // Category has changed!
            const oldCategoryId = entries[entryId]?.category
            if (oldCategoryId && oldCategoryId !== category.id) {
              delete categories[source.id][oldCategoryId].assets[entryId]
              await writeEntries(source.id, oldCategoryId)
            }

            entries[entryId] = entry
            data.assets[entryId] = entry
          }

          // Go easy on the server
          await wait(3000)
        } while (page++ < nPages)

        data.meta ??= {}
        data.meta.timestamp = now

        // Save changes
        await writeEntries(source.id, category.id)
      }
    }
  }

  // Step 3 - Resolve entries
  const resolvingEntries = new Set<AssetID>()
  await forEachAsync(entries, async (entry, entryId) => {
    if (includeEntry(entry, entryId)) {
      await resolveEntry(entryId)
    }
  })

  // Analyze base game configs
  let gameConfig = await loadConfig<SC4FileData>(dataAssetsDir, "maxis")
  if (!gameConfig?.data) {
    const gameData = await analyzeSC4Files(gameDir, ["SimCity_1.dat"], exemplarProperties)
    await writeConfig(dataAssetsDir, "maxis", gameData, ConfigFormat.YAML)
    gameConfig = { data: gameData, format: ConfigFormat.YAML }
  }

  type ExemplarsData = {
    buildings: { [id in string]?: BuildingData }
    lots: { [id in string]?: LotData }
  }

  const dbGameConfig = await loadConfig<ExemplarsData>(dbDir, "configs/exemplars")
  if (!dbGameConfig?.data) {
    await writeConfig(
      dbDir,
      "configs/exemplars",
      {
        buildings: generate(gameConfig.data.buildings, ({ model, ...data }) => [data.id, data]),
        lots: generate(gameConfig.data.lots, ({ props, textures, ...data }) => [data.id, data]),
      },
      ConfigFormat.YAML,
    )
  }

  const dbAssets = values(dbAssetsConfigs).reduce(
    (result, assets) => Object.assign(result, assets),
    {},
  )

  const dbPackages = values(dbPackagesConfigs).reduce(
    (result, packages) => Object.assign(result, packages),
    {},
  )

  // Step 4 - Check configs
  await forEachAsync(dbPackages, checkPackage)

  // Step 5 - Write changes
  await writeConfig(dbDir, "authors", dbAuthors, ConfigFormat.YAML)
  await writeOverrides(overrides)

  // Step 6 - Show errors
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

  function shouldRefreshEntryList(data: IndexerEntryList): boolean {
    const interval = options.refetchIntervalHours * 60 * 60 * 1000
    return !data.meta?.timestamp || now.getTime() >= data.meta.timestamp.getTime() + interval
  }

  async function checkPackage(packageData: PackageData, packageId: PackageID): Promise<void> {
    await checkVariant(packageData, packageId)

    if (packageData.variants) {
      await forEachAsync(packageData.variants, async (variantData, variantId) => {
        await checkVariant(variantData, packageId, variantId)
      })
    }
  }

  async function checkVariant(
    variantData: VariantData,
    packageId: PackageID,
    variantId?: VariantID,
  ): Promise<void> {
    const prefix = variantId ? `In variant ${packageId}#${variantId}` : `In package ${packageId}`

    if (variantData.assets) {
      for (const asset of variantData.assets) {
        const assetId = isString(asset) ? asset : asset.id
        if (!dbAssets[assetId]) {
          errors.add(`${prefix} - Asset ${assetId} does not exist`)
        }
      }
    }

    const authorIds = unique([
      getOwnerId(packageId),
      ...keys(variantData.credits ?? {}),
      ...keys(variantData.thanks ?? {}),
    ])

    for (const authorId of authorIds) {
      if (!dbAuthors[authorId]) {
        if (await promptYesNo(`Create author ${authorId}?`, true)) {
          dbAuthors[authorId] = {
            name: await promptAuthorName(authorId),
          }
        } else {
          errors.add(`${prefix} - Author ${authorId} does not exist`)
        }
      }
    }

    if (variantData.dependencies) {
      for (const dependency of variantData.dependencies) {
        const dependencyId = isString(dependency) ? dependency : dependency.id
        if (!dbPackages[dependencyId]) {
          errors.add(`${prefix} - Dependency ${dependencyId} does not exist`)
        }
      }
    }

    if (isString(variantData.deprecated)) {
      if (!dbPackages[variantData.deprecated]) {
        errors.add(`${prefix} - Optional dependency ${variantData.deprecated} does not exist`)
      }
    }

    if (variantData.optional) {
      for (const dependencyId of variantData.optional) {
        if (!dbPackages[dependencyId]) {
          errors.add(`${prefix} - Optional dependency ${dependencyId} does not exist`)
        }
      }
    }
  }

  function includeEntry(entry: IndexerEntry, entryId: EntryID): boolean {
    if (overrides[entryId] === null) {
      return false
    }

    if (options.include.entries.includes(entryId)) {
      return true
    }

    const sourceId = getSourceId(entryId)
    if (dbAssetsConfigs[sourceId]?.[entry.assetId]) {
      return true
    }

    if (entry.owner) {
      const authorId = getAuthorId(entry.owner)
      if (authorId && options.include.authors.includes(authorId)) {
        return true
      }
    }

    return false
  }

  function getDefaultPackageId(entry: IndexerEntry, entryId: EntryID): PackageID {
    const authorId = getAuthorId(entry.authors?.at(0) ?? getSourceId(entryId))
    return `${authorId}/${entry.assetId.split("/").at(-1)?.replace(/^\d+-/, "")}` as PackageID
  }

  function getDefaultVariantId(variantEntry: IndexerVariantEntry): VariantID {
    return variantEntry.filename?.match(/\b(dn|dark\W?nite)\b/i)
      ? ("darknite" as VariantID)
      : ("default" as VariantID)
  }

  async function getPackageId(
    entry: IndexerEntry,
    entryId: EntryID,
    hint: PackageID = getDefaultPackageId(entry, entryId),
  ): Promise<PackageID> {
    const packageId = await promptPackageId(hint)
    const ownerId = getOwnerId(packageId)

    if (!dbAuthors[ownerId]) {
      const confirmed = await promptYesNo(`Create author ${ownerId}?`, true)

      if (!confirmed) {
        return getPackageId(entry, entryId, hint)
      }

      dbAuthors[ownerId] = {
        name: await promptAuthorName(entry.owner),
      }
    }

    return packageId
  }

  async function resolveEntry(entryId: EntryID): Promise<IndexerEntry | undefined> {
    const assetId = getAssetID(entryId)

    let override = getOverride(entryId)

    // Skip ignored entry
    if (override === null || skipped.has(entryId)) {
      console.warn(`Skipping ${assetId}...`)
      return
    }

    const entry = getEntry(entryId)
    const source = getSource(entryId)
    const sourceId = getSourceId(entryId)

    // Handle dependency loop
    if (resolvingEntries.has(assetId)) {
      return entry
    }

    resolvingEntries.add(assetId)

    if (override === undefined) {
      const answer = await select<"include" | "exclude" | "skip" | "redirect">({
        choices: [
          { name: "Yes", value: "include" },
          { name: "No", value: "exclude" },
          { name: "Skip this time only", value: "skip" },
          { name: "Redirect to another asset ID", value: "redirect" },
        ],
        default: "include",
        message: `Include ${assetId}?`,
      })

      switch (answer) {
        // Include
        case "include": {
          override = overrides[entryId] ??= {}
          override.packageId = await getPackageId(entry, entryId)
          break
        }

        // Always skip
        case "exclude": {
          override = overrides[entryId] = null
          console.warn(`Skipping ${assetId}...`)
          return
        }

        // Skip this time only
        case "skip": {
          skipped.add(entryId)
          console.warn(`Skipping ${assetId}...`)
          return
        }

        // Include another asset instead
        case "redirect": {
          const superseded = await input({
            message: "Redirect to asset ID:",
            validate: value => {
              if (!/^[a-z0-9-]+[/][\d-]+(-[\w%]+)*$/.test(value)) {
                return "Invalid asset ID"
              }

              if (!entries[getEntryId(value)]) {
                return "Unknown asset"
              }

              if (getEntryId(value) === entryId) {
                return "Cannot redirect to itself"
              }

              return true
            },
          })

          override = overrides[entryId] ??= {}
          override.superseded = getAssetID(getEntryId(superseded))
          break
        }
      }
    }

    // Superseded asset, resolve the newer one instead
    if (override?.superseded) {
      return resolveEntry(getEntryId(override.superseded))
    }

    console.debug(`Resolving ${assetId}...`)

    // Fetch details if entry was never fetched, or was modified since last fetch
    if (!entry.version || !entry.meta?.timestamp || entry.meta.timestamp < entry.lastModified) {
      if (source && entry.url) {
        console.debug(`Fetching ${entry.url}...`)
        const html = await readHTML(await get(entry.url, { cookies: () => source.getCookies() }))
        const details = source.getEntryDetails(html)
        if (!details.version) {
          errors.add(`Missing version for entry ${assetId}`)
          return
        }

        entry.meta ??= {}
        entry.meta.timestamp = now

        // If a new version is available, force to extract files again
        if (entry.version !== details.version) {
          entry.meta.version = undefined
        }

        // Set details
        entry.dependencies = details.dependencies
        entry.description = details.description
        entry.images = details.images
        entry.repository = details.repository
        entry.support = details.support
        entry.version = details.version
      } else if (!entry.version) {
        errors.add(`Missing version for entry ${assetId}`)
        return
      } else {
        entry.meta ??= {}
        entry.meta.timestamp ??= now
      }

      // Save changes
      await writeEntries(getSourceId(entryId), entry.category)
    }

    // Download and analyze contents if outdated
    if (!entry.meta?.version || entry.meta.version !== options.version) {
      let hasErrors = false

      try {
        await resolveVariant(entryId)
      } catch (error) {
        console.error(error)
        errors.add((error as Error).message)
        hasErrors = true
      }

      // Resolve variants
      if (entry.variants) {
        for (const variant of keys(entry.variants)) {
          try {
            await resolveVariant(entryId, variant)
          } catch (error) {
            console.error(error)
            errors.add((error as Error).message)
            hasErrors = true
          }
        }
      }

      if (!hasErrors) {
        entry.meta.timestamp = now
        entry.meta.version = options.version
      }

      // Save changes
      await writeEntries(sourceId, entry.category)
    }

    // Resolve dependencies recursively
    const dependencies = new Set<AssetID | PackageID>()

    if (entry.dependencies) {
      for (const dependency of entry.dependencies) {
        const sourceId = getSourceId(dependency as EntryID)
        if (dbPackagesConfigs[sourceId]?.[dependency as PackageID]) {
          dependencies.add(dependency as PackageID)
        } else {
          const dependencyEntryId = getEntryId(dependency)
          const resolvedDependency = await resolveEntry(dependencyEntryId)
          if (resolvedDependency) {
            dependencies.add(resolvedDependency.assetId)
          } else {
            dependencies.add(getAssetID(dependencyEntryId, dependency))
          }
        }
      }
    }

    if (!isEqual(entry.dependencies, Array.from(dependencies))) {
      entry.dependencies = Array.from(dependencies)
      entry.meta.timestamp = now

      // Save changes
      await writeEntries(sourceId, entry.category)
    }

    // Generate packages if outdated
    if (entry.variants) {
      // Resolve "default" first
      if (entry.variants.default) {
        try {
          await generatePackages(entryId, "default")
        } catch (error) {
          console.error(error)
          errors.add((error as Error).message)
        }
      }

      // Resolve others
      for (const variant of keys(entry.variants)) {
        if (variant !== "default") {
          try {
            await generatePackages(entryId, variant)
          } catch (error) {
            console.error(error)
            errors.add((error as Error).message)
          }
        }
      }
    } else {
      try {
        await generatePackages(entryId)
      } catch (error) {
        console.error(error)
        errors.add((error as Error).message)
      }
    }

    return entry
  }

  async function resolveVariant(entryId: EntryID, variant?: string): Promise<boolean> {
    const assetId = getAssetID(entryId)
    const entry = getEntry(entryId)
    const source = getSource(entryId)

    const variantAssetId = variant ? (`${assetId}#${variant}` as AssetID) : assetId
    const variantEntry = variant ? entry.variants?.[variant] : entry
    if (!variantEntry) {
      throw Error(`Unknown variant ${variantAssetId}`)
    }

    const version = entry.version

    if (!version) {
      throw Error(`Entry ${assetId} does not have a version`)
    }

    let variantOverride = getOverride(entryId, variant)

    if (variantOverride === undefined) {
      if (!variant) {
        throw Error(`Expected override to exist for ${assetId}`)
      }

      overrides[entryId] ??= {}
      overrides[entryId].variants ??= {}

      if (await promptYesNo(`Include ${variantAssetId}? ${variantEntry.filename}`, true)) {
        variantOverride = overrides[entryId].variants[variant] ??= {}
        variantOverride.packageId = await getPackageId(entry, entryId, overrides[entryId].packageId)
      } else {
        variantOverride = overrides[entryId].variants[variant] = null
      }
    }

    if (variantOverride === null) {
      console.warn(`Skipping ${variantAssetId}...`)
      return false
    }

    if (!variant && entry.variants && entry.meta?.version) {
      // Nothing else to do here - we will resolve each variant individually later
      return false
    }

    const downloadKey = `${variantAssetId}@${entry.version}`
    const downloadPath = path.join(dataDownloadsDir, downloadKey)
    const downloadTempPath = path.join(dataDownloadsTempDir, downloadKey)

    const defaultDownloadUrl = source?.getDownloadUrl(assetId, variant)
    let downloadUrl = variantEntry.download ?? defaultDownloadUrl
    let downloaded = await exists(downloadPath)

    if (!downloadUrl) {
      downloadUrl = await promptUrl("Download URL", downloadUrl)
      variantEntry.download = downloadUrl
    }

    // Download files (or extract variants)
    if (!downloaded || !variantEntry.sha256 || !variantEntry.size) {
      await removeIfPresent(downloadPath)
      downloaded = false

      while (!downloaded) {
        const finalDownloadUrl = downloadUrl.replaceAll("{version}", version)

        console.debug(`Downloading ${finalDownloadUrl}...`)

        try {
          const response = await get(finalDownloadUrl, {
            cookies: () => source?.getCookies(),
          })

          const contentType = response.headers.get("Content-Type")

          // HTML response - Simtropolis variant listing
          if (contentType?.startsWith("text/html")) {
            if (variant || !source) {
              throw Error("Unexpected HTML")
            }

            // Extract variants
            const html = await readHTML(response)
            const variants = source.getVariants(html)

            // Clear previous data
            entry.filename = undefined
            entry.files = undefined
            entry.sha256 = undefined
            entry.size = undefined
            entry.uncompressed = undefined
            entry.variants = mapValues(variants, (filename, variant) => ({
              ...entry.variants?.[variant],
              filename,
            }))

            // Nothing else to do here - we will resolve each variant individually later
            return false
          }

          const { filename, sha256, size, uncompressedSize } = await download(response, {
            downloadPath,
            downloadTempPath,
            async exePath(exe) {
              return getExePath(exe)
            },
            url: downloadUrl,
          })

          variantEntry.filename = filename
          variantEntry.files = undefined
          variantEntry.sha256 = sha256
          variantEntry.size = size
          variantEntry.uncompressed = uncompressedSize

          if (!variant) {
            entry.variants = undefined
          }

          downloaded = true
        } catch (error) {
          console.error(error)

          // Suggest to retry with different URL
          if (await promptYesNo("Override download URL?")) {
            downloadUrl = await promptUrl("Download URL", downloadUrl)
            variantEntry.download = downloadUrl
          } else {
            throw Error(`Failed to download ${variantAssetId}`)
          }
        }
      }
    }

    // Extract files
    if (!variantEntry.files || variantEntry.files) {
      console.debug(`Extracting ${downloadKey}...`)

      try {
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
      } catch (error) {
        console.error(error)
        throw Error(`Failed to extract ${variantAssetId}`)
      }
    }

    // Analyze DBPF contents
    const {
      buildingFamilies,
      buildings,
      categories,
      features,
      lots,
      models,
      propFamilies,
      props,
      textures,
    } = await analyzeSC4Files(downloadPath, variantEntry.files, exemplarProperties)

    variantEntry.buildingFamilies = buildingFamilies.length ? buildingFamilies : undefined
    variantEntry.buildings = buildings.length ? buildings : undefined
    variantEntry.categories = categories.length ? categories : undefined
    variantEntry.features = features.length ? features : undefined
    variantEntry.lots = lots.length ? lots : undefined
    variantEntry.models = models.length ? models : undefined
    variantEntry.propFamilies = propFamilies.length ? propFamilies : undefined
    variantEntry.props = props.length ? props : undefined
    variantEntry.textures = textures.length ? textures : undefined

    return true
  }

  async function generatePackages(entryId: EntryID, variant?: string): Promise<boolean> {
    const assetId = getAssetID(entryId)
    const entry = getEntry(entryId)
    const source = getSource(entryId)
    const sourceId = getSourceId(entryId)

    const entryOverride = getOverride(entryId)
    const variantOverride = getOverride(entryId, variant)
    const variantAssetId = variant ? (`${assetId}#${variant}` as AssetID) : assetId
    const variantEntry = variant ? entry.variants?.[variant] : entry
    let basePackageId = variantOverride?.packageId ?? entryOverride?.packageId

    if (entryOverride === null || variantOverride === null || !entry.meta?.timestamp) {
      return false
    }

    if (!variantEntry?.files) {
      throw Error(`Expected files to exist for ${variantAssetId}`)
    }

    if (!entry.version) {
      throw Error(`Expected version to exist for ${variantAssetId}`)
    }

    if (!variantOverride) {
      throw Error(`Expected override to exist for ${variantAssetId}`)
    }

    // Create or update asset data
    const assetData = dbAssetsConfigs[sourceId]?.[variantAssetId] ?? {}
    assetData.lastModified = entry.lastModified
    assetData.sha256 = variantEntry.sha256
    assetData.size = variantEntry.size
    assetData.uncompressed = variantEntry.uncompressed
    assetData.url = variantEntry.download
    assetData.version = entry.version
    dbAssetsConfigs[sourceId] ??= {}
    dbAssetsConfigs[sourceId][variantAssetId] = assetData
    await writeConfig(dbAssetsDir, sourceId, dbAssetsConfigs[sourceId], ConfigFormat.YAML)

    if (basePackageId === undefined) {
      basePackageId = await getPackageId(entry, entryId)
      variantOverride.packageId = basePackageId
    }

    if (!variantOverride.variantId) {
      console.debug(`Generating package for ${variantAssetId} -> ${basePackageId}`)
      // Try to infer DarkNite variants from filename
      const defaultVariantId = getDefaultVariantId(variantEntry)
      const overrideVariantId = await promptVariantId(defaultVariantId, variantEntry.filename)
      variantOverride.variantId = overrideVariantId
    }

    const baseIsOverride = !!variantOverride.override
    const baseVariantIds = parseStringArray(variantOverride.variantId) as VariantID[]

    const outputs = new Set<string>()
    for (const baseVariantId of baseVariantIds) {
      if (!outputs.has(`${basePackageId}#${baseVariantId}`)) {
        await generateVariant(basePackageId, baseVariantId)
        outputs.add(`${basePackageId}#${baseVariantId}`)
      }
    }

    if (variantOverride.paths) {
      for (const pathOverride of values(variantOverride.paths)) {
        if (pathOverride) {
          const pathPackageId = pathOverride.packageId ?? basePackageId
          const pathVariantIds = pathOverride.variantId
            ? (parseStringArray(pathOverride.variantId) as VariantID[])
            : baseVariantIds
          for (const pathVariantId of pathVariantIds) {
            if (!outputs.has(`${pathPackageId}#${pathVariantId}`)) {
              await generateVariant(pathPackageId, pathVariantId)
              outputs.add(`${pathPackageId}#${pathVariantId}`)
            }
          }
        }
      }
    }

    async function generateVariant(packageId: PackageID, variantId: VariantID) {
      const variantAssetId = variant ? (`${assetId}#${variant}` as AssetID) : assetId
      const variantEntry = variant ? entry.variants?.[variant] : entry
      const variantOverride = getOverride(entryId, variant)

      if (variantOverride === null || !entry.meta?.timestamp) {
        return false
      }

      if (!variantEntry?.files || !entry.version || !variantOverride) {
        throw Error(`Expected override to exist for ${variantAssetId}`)
      }

      const dependencies = mapDefined(entry.dependencies ?? [], dependency => {
        const sourceId = getSourceId(dependency as EntryID)

        if (dbPackagesConfigs[sourceId]?.[dependency as PackageID]) {
          return dependency as PackageID
        }

        return getOverride(getEntryId(dependency))?.packageId
      })

      const ownerId = getOwnerId(packageId)
      const authors = remove(mapDefined(entry.authors ?? [], getAuthorId), ownerId)

      const packageData = dbPackagesConfigs[ownerId]?.[packageId] ?? {}
      const variantData = packageData.variants?.[variantId]

      // Create or update package/variant data
      if (
        !variantData?.lastGenerated ||
        variantData.lastGenerated < entry.meta.timestamp ||
        packageId.match(/functional/)
      ) {
        if (variantData) {
          console.debug(`Updating variant ${packageId}#${variantId}...`)
        } else {
          console.debug(`Creating variant ${packageId}#${variantId}...`)
        }

        const packageFiles: { [path in string]?: PackageFile } = {}
        let includedFiles = variantEntry.files
        let excludedFiles: string[] = []
        if (variantOverride.paths) {
          const matchedFiles = new Set<string>()
          const unmatchedFiles = new Set(variantEntry.files)
          for (const path in variantOverride.paths) {
            const pattern = globToRegex(path)
            const pathOverride = variantOverride.paths[path]

            if (pathOverride === null) {
              for (const file of variantEntry.files) {
                if (pattern.test(file)) {
                  unmatchedFiles.delete(file)
                }
              }
            } else {
              const pathIsOverride = pathOverride?.override ?? baseIsOverride
              const pathPackageId = pathOverride?.packageId ?? basePackageId
              const pathVariantIds = pathOverride?.variantId
                ? (parseStringArray(pathOverride.variantId) as VariantID[])
                : baseVariantIds

              const isMatching = packageId === pathPackageId && pathVariantIds.includes(variantId)

              for (const file of variantEntry.files) {
                if (pattern.test(file)) {
                  unmatchedFiles.delete(file)
                  if (isMatching) {
                    matchedFiles.add(file)
                    if (pathIsOverride) {
                      packageFiles[file] ??= { path: file }
                      packageFiles[file].priority ??= 900
                    }
                  }
                }
              }
            }
          }

          if (packageId === basePackageId && baseVariantIds.includes(variantId)) {
            for (const file of unmatchedFiles) {
              matchedFiles.add(file)
              if (baseIsOverride) {
                packageFiles[file] ??= { path: file }
                packageFiles[file].priority ??= 900
              }
            }
          }

          includedFiles = Array.from(matchedFiles.values())
          excludedFiles = variantEntry.files.filter(file => !matchedFiles.has(file))
        }

        dbPackagesConfigs[ownerId] ??= {}
        dbPackagesConfigs[ownerId][packageId] = writePackageData(
          packageData,
          packageId,
          assetId,
          source,
          entry,
          variant,
          variantId,
          includedFiles,
          excludedFiles,
          packageFiles,
          authors,
          dependencies,
          now,
        )

        // Save changes
        await writeConfig(dbPackagesDir, ownerId, dbPackagesConfigs[ownerId], ConfigFormat.YAML)
      }
    }

    return true
  }

  async function loadEntries(
    sourceId: IndexerSourceID,
    categoryId: IndexerSourceCategoryID = UNCATEGORIZED,
  ): Promise<IndexerEntryList> {
    const config = await loadConfig<IndexerEntryList>(dataAssetsDir, `${sourceId}/${categoryId}`)
    const data = config?.data ?? { assets: {} }
    categories[sourceId] ??= {}
    categories[sourceId][categoryId] = data
    return data
  }

  async function writeEntries(
    sourceId: IndexerSourceID,
    categoryId: IndexerSourceCategoryID = UNCATEGORIZED,
  ): Promise<void> {
    const data = categories[sourceId][categoryId]
    await writeConfig(dataAssetsDir, `${sourceId}/${categoryId}`, data, ConfigFormat.YAML)
  }

  async function loadOverrides(): Promise<{
    [entryId in EntryID]?: IndexerOverride | null
  }> {
    const config = await loadConfig<{
      [assetId in AssetID]?: IndexerOverride | null
    }>(dataAssetsDir, "overrides")

    const data: {
      [entryId in EntryID]?: IndexerOverride | null
    } = {}

    if (config) {
      forEach(config.data, (override, assetId) => {
        data[getEntryId(assetId)] = override
      })
    }

    return data
  }

  async function writeOverrides(
    overrides: {
      [entryId in EntryID]?: IndexerOverride | null
    },
  ): Promise<void> {
    const data: {
      [assetId in AssetID]?: IndexerOverride | null
    } = {}

    forEach(overrides, (override, entryId) => {
      data[getAssetID(entryId)] = override
    })

    await writeConfig<{
      [entryId in EntryID]?: IndexerOverride | null
    }>(dataAssetsDir, "overrides", data, ConfigFormat.YAML)
  }

  function getAuthorId(authorName: string): AuthorID | undefined {
    const lowercased = authorName.toLowerCase()
    const rawId = toID(authorName) as AuthorID

    return keys(dbAuthors).find(
      authorId =>
        authorId === rawId ||
        dbAuthors[authorId].name.toLowerCase() === lowercased ||
        dbAuthors[authorId].alias?.some(alias => alias.toLowerCase() === lowercased),
    )
  }
}

function getExePath(exe: string): string {
  return process.env[`INDEXER_EXE_PATH_${exe.toUpperCase()}`] || exe
}

async function loadExemplarProperties(): Promise<{ [id: number]: ExemplarPropertyInfo }> {
  console.debug("Loading authors...")
  const config = await loadConfig<{ [id: string]: ExemplarPropertyData }>(
    dbDir,
    "configs/exemplar-properties",
  )

  const properties: Record<string, ExemplarPropertyInfo> = {}

  forEach(config?.data ?? {}, (data, propertyIdHex) => {
    const propertyInfo: ExemplarPropertyInfo = {
      ...data,
      type: data.type && ExemplarValueType[data.type],
    }

    if (propertyIdHex.includes("-")) {
      const [firstId, lastId] = propertyIdHex.split("-").map(parseHex)
      for (let propertyId = firstId; propertyId <= lastId; propertyId++) {
        properties[propertyId] = propertyInfo
      }
    } else {
      const propertyId = parseHex(propertyIdHex)
      properties[propertyId] = propertyInfo
    }
  })

  return properties
}

async function loadAuthorsFromDB(): Promise<{ [authorId: AuthorID]: AuthorData }> {
  console.debug("Loading authors...")
  const config = await loadConfig<{ [authorId: AuthorID]: AuthorData }>(dbDir, "authors")
  return config?.data ?? {}
}

async function loadAssetsFromDB(): Promise<{
  [sourceId: IndexerSourceID]: { [assetId in AssetID]?: AssetData }
}> {
  const configs: { [sourceId: IndexerSourceID]: { [assetId in AssetID]?: AssetData } } = {}

  const filePaths = await glob("*.yaml", { cwd: dbAssetsDir })
  for (const filePath of filePaths) {
    const sourceId = path.basename(filePath, path.extname(filePath)) as IndexerSourceID
    console.debug(`Loading assets from ${sourceId}...`)
    const config = await loadConfig<{ [assetId in AssetID]?: AssetData }>(dbAssetsDir, sourceId)
    configs[sourceId] = config?.data ?? {}
  }

  return configs
}

async function loadPackagesFromDB(): Promise<{
  [authorId: string]: { [packageId in PackageID]?: PackageData }
}> {
  const configs: { [authorId: string]: { [packageId in PackageID]?: PackageData } } = {}

  const filePaths = await glob("*.yaml", { cwd: dbPackagesDir, nodir: true })
  for (const filePath of filePaths) {
    const authorId = path.basename(filePath, path.extname(filePath))
    console.debug(`Loading packages from ${authorId}...`)
    const fullPath = path.join(dbPackagesDir, filePath)
    const data = await readConfig<{ [packageId in PackageID]?: PackageData }>(fullPath)
    configs[authorId] = data
  }

  return configs
}

function getEntryId(assetId: string): EntryID {
  return (assetId.match(/^([a-z0-9-]+[/]\d+)(-[^/]+)?$/)?.[1] ?? assetId) as EntryID
}

function getSourceId(entryId: EntryID): IndexerSourceID {
  return entryId.split("/")[0] as IndexerSourceID
}
