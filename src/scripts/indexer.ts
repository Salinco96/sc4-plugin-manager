import { readdir } from "node:fs/promises"
import path from "node:path"

import { input, select } from "@inquirer/prompts"
import {
  $init,
  ID,
  containsAny,
  difference,
  filterValues,
  findEntry,
  findKey,
  forEach,
  forEachAsync,
  generate,
  getRequired,
  groupBy,
  indexBy,
  isEmpty,
  isEqual,
  isString,
  keys,
  mapDefined,
  mapValues,
  merge,
  parseHex,
  sort,
  union,
  unique,
  values,
} from "@salinco/nice-utils"
import { config } from "dotenv"
import { glob } from "glob"

import type { AssetID, Assets } from "@common/assets"
import {
  type AuthorData,
  type AuthorID,
  type AuthorInfo,
  loadAuthorInfo,
  writeAuthorInfo,
} from "@common/authors"
import type { BuildingID } from "@common/buildings"
import {
  type ExemplarPropertyData,
  type ExemplarPropertyInfo,
  ExemplarValueType,
} from "@common/exemplars"
import type { FamilyID } from "@common/families"
import type { LotID } from "@common/lots"
import type { FloraID } from "@common/mmps"
import { type PackageID, getOwnerId } from "@common/packages"
import type { PropID } from "@common/props"
import { ConfigFormat, type PackageInfo, type Packages } from "@common/types"
import { globToRegex } from "@common/utils/glob"
import { parseStringArray } from "@common/utils/types"
import type { VariantAssetInfo, VariantInfo } from "@common/variants"
import type { VariantID } from "@common/variants"
import { loadConfig, readConfig, writeConfig } from "@node/configs"
import { type AssetData, loadAssetInfo, writeAssetInfo } from "@node/data/assets"
import { type PackageData, loadPackageInfo, writePackageInfo } from "@node/data/packages"
import type { ContentsData } from "@node/data/packages"
import { download } from "@node/download"
import { extractRecursively } from "@node/extract"
import { get } from "@node/fetch"

import type { Categories, CategoryID } from "@common/categories"
import { exists, removeIfPresent, toPosix } from "@node/files"
import { analyzeSC4Files } from "./dbpf/dbpf"
import { generateVariantInfo, registerVariantAsset } from "./dbpf/packages"
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
  IndexerCategoryID,
  IndexerEntry,
  IndexerEntryList,
  IndexerOptions,
  IndexerOverride,
  IndexerPathOverride,
  IndexerSource,
  IndexerSourceID,
  IndexerVariantEntry,
} from "./types"
import { getEnvRequired, readHTML, toID, wait } from "./utils"

config({ path: ".env.local" })

const GITHUB: IndexerSourceID = ID("github")

const now = new Date()

const dataDir = path.join(__dirname, "data")
const dataAssetsDir = path.join(dataDir, "assets")
const dataDownloadsDir = getEnvRequired("INDEXER_DOWNLOADS_PATH")
const dataDownloadsTempDir = getEnvRequired("INDEXER_DOWNLOADS_TEMP_PATH")
const gameDir = getEnvRequired("INDEXER_GAME_PATH")

const dbDir = path.join(__dirname, "../../sc4-plugin-manager-data")
const dbAssetsDir = path.join(dbDir, "assets")
const dbPackagesDir = path.join(dbDir, "packages")

runIndexer({
  include: {
    authors: {
      buggi: 2000,
      "dead-end": 2000,
      cococity: 2000,
      jasoncw: 2020, // todo
      madhatter106: 2012, // todo
      memo: 2000,
      "null-45": 2000,
      simmaster07: 2000,
      toroca: 2000,
      wannglondon: 2024, // todo
    },
    entries: [
      "simtropolis/13318",
      "simtropolis/15758",
      "simtropolis/21339",
      "simtropolis/22771",
      "simtropolis/23089",
      "simtropolis/27340",
      "simtropolis/27712",
      "simtropolis/29749",
      "simtropolis/30836",
      "simtropolis/33889",
    ],
  },
  migrate: {
    entries(entry) {
      if (entry.variants) {
        forEach(entry.variants, variant => {
          // Nothing
        })
      }
    },
  },
  refetchIntervalHours: 20,
  sources: [SC4EVERMORE, SIMTROPOLIS],
  version: 1,
})

async function runIndexer(options: IndexerOptions): Promise<void> {
  const sources = indexBy(options.sources, source => source.id)

  const indexerMeta: {
    [sourceId in IndexerSourceID | `${IndexerSourceID}/${IndexerCategoryID}`]?: {
      timestamp?: Date
    }
  } = {}

  const errors = new Set<string>()

  const assetIds: { [entryId in EntryID]?: AssetID } = {}
  const entries: { [entryId in EntryID]?: IndexerEntry } = {}

  function getAssetID(entryId: EntryID, hint?: string): AssetID {
    assetIds[entryId] ??= (hint ?? entryId) as AssetID
    return assetIds[entryId]
  }

  function getEntry(entryId: EntryID): IndexerEntry {
    return getRequired(entryId)(entries)
  }

  function getOverride(entryId: EntryID, variant?: string): IndexerOverride | null | undefined {
    const override = overrides[entryId]
    return variant ? override?.variants?.[variant] : override
  }

  function getSource(entryId: EntryID): IndexerSource | undefined {
    return sources[getSourceId(entryId)]
  }

  const generatingPackages: { [packageId in PackageID]?: VariantID[] } = {}
  const skippedEntries = new Set<EntryID>()

  /**
   * STEP 1 - Load database and indexer files
   */

  // Step 1a - Load database
  const assets = await loadAssetsFromDB()
  const dbAuthors = await loadAuthorsFromDB()
  const categories = await loadCategories()
  const exemplarProperties = await loadExemplarProperties()
  const overrides = await loadOverrides()
  const packages = await loadPackagesFromDB(categories)

  // Step 1b - Load existing categorized entries
  for (const source of options.sources) {
    for (const category of values(source.categories)) {
      const categoryId = `${source.id}/${category.id}` as const
      console.debug(`Loading entries from ${categoryId}...`)

      const config = await loadConfig<IndexerEntryList>(dataAssetsDir, categoryId)

      if (config) {
        indexerMeta[categoryId] = config.data.meta
        forEach(config.data.assets, (entry, entryId) => {
          options.migrate?.entries?.(entry, entryId)
          assetIds[entryId] = entry.assetId
          entries[entryId] = entry
        })
      }
    }
  }

  // Step 1c - Load existing uncategorized entries
  for (const child of await readdir(dataAssetsDir, { withFileTypes: true })) {
    if (child.isDirectory()) {
      const sourceId = child.name as IndexerSourceID
      console.debug(`Loading entries from ${sourceId}...`)

      const config = await loadConfig<IndexerEntryList>(dataAssetsDir, `${sourceId}/uncategorized`)

      if (config) {
        indexerMeta[sourceId] = config.data.meta
        forEach(config.data.assets, (entry, entryId) => {
          options.migrate?.entries?.(entry, entryId)
          assetIds[entryId] = entry.assetId
          entries[entryId] = entry
        })
      }
    }
  }

  /**
   * STEP 2 - Find and add new or newly-updated entries
   *
   * New entries/versions may come from 3 sources:
   *  - Simtropolis/SC4Evermore listings by category (ordered by last modified time)
   *  - Assets manually created in database repository, if they have an explicit URL and version
   *  - Latest release of known GitHub repositories, fetched by GitHub API
   */

  // Step 2a - Fetch new entries from Simtropolis/SC4Evermore
  for (const source of options.sources) {
    for (const category of values(source.categories)) {
      const meta = $init(indexerMeta, `${source.id}/${category.id}`, { timestamp: undefined }) // todo: fix type
      const lastRefreshed = meta?.timestamp

      // Check whether to refetch asset listing for this category
      if (shouldRefreshEntryList(lastRefreshed)) {
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
            if (source === SIMTROPOLIS && lastRefreshed && baseEntry.lastModified < lastRefreshed) {
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

            entries[entryId] = entry
          }

          // Go easy on the server
          await wait(3000)
        } while (page++ < nPages)

        meta.timestamp = now
      }
    }
  }

  // Step 2b - Create entries for orphan assets with an explicit URL and version
  await forEachAsync(assets, async (assetInfo, assetId) => {
    const entryId = getEntryId(assetId)

    if (assetInfo.url && assetInfo.version && !entries[entryId]) {
      console.debug(`Creating entry ${entryId} from asset ${assetId}...`)

      // GitHub asset IDs with format github/[user]/[repo]
      const githubUserId = entryId.match(/^github[/]([^/]+)[/][^/]+$/)?.[1]

      assetIds[entryId] = assetId
      entries[entryId] = {
        assetId,
        authors: githubUserId ? [githubUserId] : undefined,
        download: assetInfo.url,
        lastModified: new Date(assetInfo.lastModified ?? now),
        version: assetInfo.version,
      }
    }
  })

  // Step 2c - Check for new Github releases
  const githubMeta = $init(indexerMeta, GITHUB, { timestamp: undefined }) // todo: fix type
  if (shouldRefreshEntryList(githubMeta?.timestamp)) {
    await forEachAsync(entries, async (entry, entryId) => {
      if (getSourceId(entryId) === GITHUB) {
        const repository =
          entry.download?.match(/^https:[/][/]github[.]com[/]([^/]+[/][^/]+)/)?.[1] ??
          entry.repository?.match(/^https:[/][/]github[.]com[/]([^/]+[/][^/]+)/)?.[1] ??
          entryId.match(/^github[/]([^/]+[/][^/]+)$/)?.[1]

        if (repository) {
          entry.repository = `https://github.com/${repository}`
          const latestUrl = `https://api.github.com/repos/${repository}/releases/latest`

          try {
            console.debug(`Fetching ${latestUrl}...`)
            const response = await get(latestUrl)

            const latest: {
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
            } = await response.json()

            const version = latest.tag_name.replace(/^v/i, "") // remove leading v
            const assetName = entry.download?.split("/").at(-1)?.replace("{version}", version)
            const asset = latest.assets.find(asset => asset.name === assetName)

            if (asset && (!entry.download || entry.version !== version)) {
              entry.download = asset.browser_download_url.replaceAll(version, "{version}")
              entry.filename = asset.name
              entry.files = undefined
              entry.lastModified = new Date(asset.updated_at)
              entry.meta = undefined
              entry.sha256 = undefined
              entry.size = undefined
              entry.uncompressed = undefined
              entry.version = version
            }

            // GitHub API will limit us if we fetch too quickly
            await wait(3000)
          } catch (error) {
            console.error(`Failed to fetch ${latestUrl}`, error)
            errors.add(`Failed to fetch ${latestUrl}`)
          }
        }
      }
    })

    githubMeta.timestamp = now
  }

  /**
   * STEP 3 - Download, analyze, and generate package data from entries
   *
   * Checking the generated data still takes some manual work, so we need to generate packages bit by bit.
   * We generate only the packages explicitly included, as well as their (transitive) dependencies.
   *
   * All links to another known package in a package's description are detected as dependencies.
   * Undesired dependencies can be ignored.
   */

  // Step 3a - Resolve entries and register the corresponding packages/variants
  const resolvingEntries = new Set<AssetID>()
  await forEachAsync(entries, async (entry, entryId) => {
    if (includeEntry(entry, entryId)) {
      await resolveEntry(entryId)
    }
  })

  // Step 3b - Generate packages/variants
  forEach(generatingPackages, async (variantIds, packageId) => {
    for (const variantId of variantIds) {
      try {
        generateVariant(packageId, variantId)
      } catch (error) {
        console.error(error)
        errors.add((error as Error).message)
      }
    }
  })

  /**
   * STEP 4 - Write generated data back to files
   */

  // Step 4a - Write overrides
  console.debug("Writing overrides...")
  await writeOverrides(overrides)

  // Step 4b - Write authors
  console.debug("Writing authors...")
  await writeConfig(dbDir, "authors", mapValues(dbAuthors, writeAuthorInfo), ConfigFormat.YAML)

  // Step 4c - Write entries
  console.debug("Writing entries...")
  await forEachAsync(indexerMeta, async (meta, key) => {
    const [sourceId, categoryId] = key.split("/") as [IndexerSourceID, IndexerCategoryID?]

    await writeConfig<IndexerEntryList>(
      dataAssetsDir,
      `${sourceId}/${categoryId ?? "uncategorized"}`,
      {
        assets: filterValues(
          entries,
          (entry, entryId) => getSourceId(entryId) === sourceId && entry.category === categoryId,
        ),
        meta,
      },
      ConfigFormat.YAML,
    )
  })

  // Step 4c - Write asset changes
  console.debug("Writing assets...")
  const assetsBySource = groupBy(values(assets), assetInfo => getSourceId(assetInfo.id))
  await forEachAsync(assetsBySource, async (assets, sourceId) => {
    await writeConfig<{ [assetId in AssetID]?: AssetData }>(
      dbAssetsDir,
      sourceId,
      mapValues(
        indexBy(assets, assetInfo => assetInfo.id),
        writeAssetInfo,
      ),
      ConfigFormat.YAML,
    )
  })

  // Step 4d - Write package changes
  console.debug("Writing packages...")
  const modifiedAuthors = new Set(keys(generatingPackages).map(getOwnerId))
  for (const authorId of modifiedAuthors) {
    await writeConfig<{ [packageId in PackageID]?: PackageData }>(
      dbPackagesDir,
      authorId,
      mapValues(
        filterValues(packages, info => getOwnerId(info.id) === authorId),
        info => writePackageInfo(info, false, categories),
      ),
      ConfigFormat.YAML,
    )
  }

  /**
   * STEP 5 - Analyze Maxis files if necessary
   */

  // Step 5a - Analyze Maxis files
  const indexerMaxisConfig = await loadConfig<ContentsData>(dataAssetsDir, "maxis")
  let maxisData = indexerMaxisConfig?.data
  if (!maxisData) {
    const data = await analyzeSC4Files(
      gameDir,
      ["SimCity_1.dat", "SimCity_2.dat", "SimCity_3.dat", "SimCity_4.dat", "SimCity_5.dat"],
      exemplarProperties,
    )

    await writeConfig(dataAssetsDir, "maxis", data.contents, ConfigFormat.YAML)
    maxisData = data.contents
  }

  // Step 5b - Generate Maxis data
  const dbMaxisConfig = await loadConfig<ContentsData>(dbDir, "configs/maxis")
  if (!dbMaxisConfig?.data) {
    console.debug("Writing Maxis contents...")

    // Remove some unnecessary fields
    const data: ContentsData = {
      buildingFamilies: maxisData.buildingFamilies ?? {},
      buildings: mapValues(maxisData.buildings ?? {}, buildings =>
        mapValues(buildings, ({ model, ...data }) => data),
      ),
      lots: mapValues(maxisData.lots ?? {}, lots =>
        mapValues(lots, ({ props, textures, ...data }) => data),
      ),
      mmps: mapValues(maxisData.mmps ?? {}, mmps =>
        mapValues(mmps, ({ model, stages, ...data }) => ({
          ...data,
          stages: stages?.map(({ model, ...stage }) => stage),
        })),
      ),
      propFamilies: maxisData.propFamilies ?? {},
      props: mapValues(maxisData.props ?? {}, props =>
        mapValues(props, ({ model, ...data }) => data),
      ),
      textures: mapValues(maxisData.textures ?? {}, sort),
    }

    await writeConfig<ContentsData>(dbDir, "configs/maxis", data, ConfigFormat.YAML)
  }

  /**
   * STEP 6 - Create a reverse-index of TGIs to the packages containing them
   */

  if (!isEmpty(generatingPackages)) {
    type Index = {
      buildingFamilies: { [id in FamilyID]?: PackageID[] }
      buildings: { [id in BuildingID]?: PackageID[] }
      lots: { [id in LotID]?: PackageID[] }
      mmps: { [id in FloraID]?: PackageID[] }
      models: { [id in string]?: PackageID[] }
      propFamilies: { [id in FamilyID]?: PackageID[] }
      props: { [id in PropID]?: PackageID[] }
      textures: { [id in string]?: PackageID[] }
    }

    const index: Index = {
      buildingFamilies: {},
      buildings: {},
      lots: {},
      mmps: {},
      models: {},
      propFamilies: {},
      props: {},
      textures: {},
    }

    // Step 6a - Index instances
    console.debug("Indexing contents...")
    forEach(packages, (packageInfo, packageId) => {
      forEach(packageInfo.variants, variantInfo => {
        if (variantInfo.buildingFamilies) {
          for (const { id } of variantInfo.buildingFamilies) {
            if (!index.buildingFamilies[id]?.includes(packageId)) {
              index.buildingFamilies[id] ??= []
              index.buildingFamilies[id].push(packageId)
            }
          }
        }

        if (variantInfo.buildings) {
          for (const { id } of variantInfo.buildings) {
            if (!index.buildings[id]?.includes(packageId)) {
              index.buildings[id] ??= []
              index.buildings[id].push(packageId)
            }
          }
        }

        if (variantInfo.lots) {
          for (const { id } of variantInfo.lots) {
            if (!index.lots[id]?.includes(packageId)) {
              index.lots[id] ??= []
              index.lots[id].push(packageId)
            }
          }
        }

        if (variantInfo.models) {
          for (const id of values(variantInfo.models).flat()) {
            if (!index.models[id]?.includes(packageId)) {
              index.models[id] ??= []
              index.models[id].push(packageId)
            }
          }
        }

        if (variantInfo.mmps) {
          for (const { id, stages } of variantInfo.mmps) {
            if (!index.mmps[id]?.includes(packageId)) {
              index.mmps[id] ??= []
              index.mmps[id].push(packageId)
            }

            if (stages) {
              for (const { id } of stages) {
                if (!index.mmps[id]?.includes(packageId)) {
                  index.mmps[id] ??= []
                  index.mmps[id].push(packageId)
                }
              }
            }
          }
        }

        if (variantInfo.propFamilies) {
          for (const { id } of variantInfo.propFamilies) {
            if (!index.propFamilies[id]?.includes(packageId)) {
              index.propFamilies[id] ??= []
              index.propFamilies[id].push(packageId)
            }
          }
        }

        if (variantInfo.props) {
          for (const { id } of variantInfo.props) {
            if (!index.props[id]?.includes(packageId)) {
              index.props[id] ??= []
              index.props[id].push(packageId)
            }
          }
        }

        if (variantInfo.textures) {
          for (const id of values(variantInfo.textures).flat()) {
            if (!index.textures[id]?.includes(packageId)) {
              index.textures[id] ??= []
              index.textures[id].push(packageId)
            }
          }
        }
      })
    })

    // Step 6b - Generate index file
    console.debug("Writing index...")
    await writeConfig(dataAssetsDir, "index", index, ConfigFormat.YAML)
  }

  /**
   * STEP 7 - Check the consistency of data repository (e.g. dependencies must exist)
   */
  console.debug("Checking packages...")
  await forEachAsync(packages, checkPackage)

  // Step 7b - Write new authors
  // TODO: -.-
  console.debug("Writing authors...")
  await writeConfig(dbDir, "authors", mapValues(dbAuthors, writeAuthorInfo), ConfigFormat.YAML)

  /**
   * STEP 8 - Show all errors encountered during this run
   */
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

  function shouldRefreshEntryList(lastRefreshed: Date | undefined): boolean {
    const interval = options.refetchIntervalHours * 60 * 60 * 1000
    return !lastRefreshed || now.getTime() >= lastRefreshed.getTime() + interval
  }

  async function checkPackage(packageInfo: PackageInfo): Promise<void> {
    await forEachAsync(packageInfo.variants, async variantInfo => {
      await checkVariant(variantInfo, packageInfo.id)
    })
  }

  async function checkVariant(variantInfo: VariantInfo, packageId: PackageID): Promise<void> {
    const prefix = `In variant ${packageId}#${variantInfo.id}`

    if (variantInfo.assets) {
      for (const asset of variantInfo.assets) {
        if (!assets[asset.id]) {
          errors.add(`${prefix} - Asset ${asset.id} does not exist`)
        }
      }
    }

    const authors = unique([
      ...variantInfo.authors,
      ...mapDefined(variantInfo.credits ?? [], credit => credit.id),
      ...mapDefined(variantInfo.thanks ?? [], credit => credit.id),
    ])

    for (const authorId of authors) {
      if (!dbAuthors[authorId]) {
        if (await promptYesNo(`Create author ${authorId}?`, true)) {
          dbAuthors[authorId] = {
            id: authorId,
            name: await promptAuthorName(authorId),
          }
        } else {
          errors.add(`${prefix} - Author ${authorId} does not exist`)
        }
      }
    }

    if (variantInfo.categories) {
      for (const category of variantInfo.categories) {
        if (!categories[category]) {
          errors.add(`${prefix} - Category ${category} does not exist`)
        }
      }
    }

    if (variantInfo.dependencies) {
      for (const dependency of variantInfo.dependencies) {
        if (!packages[dependency.id]) {
          errors.add(`${prefix} - Dependency ${dependency.id} does not exist`)
        }
      }
    }

    if (isString(variantInfo.deprecated)) {
      if (!packages[variantInfo.deprecated]) {
        errors.add(`${prefix} - Package ${variantInfo.deprecated} does not exist`)
      }
    }

    // todo: check features

    if (variantInfo.optional) {
      for (const dependencyId of variantInfo.optional) {
        if (!packages[dependencyId]) {
          errors.add(`${prefix} - Optional dependency ${dependencyId} does not exist`)
        }
      }
    }

    // todo: check that dependencies contain the needed props/models/textures...
  }

  function includeEntry(entry: IndexerEntry, entryId: EntryID): boolean {
    if (overrides[entryId] === null) {
      return false
    }

    if (options.include.entries.includes(entryId)) {
      return true
    }

    if (assets[entry.assetId]) {
      return true
    }

    if (entry.authors) {
      const year = entry.lastModified.getFullYear()

      const authors = entry.authors.map(author => getAuthorId(author) ?? toID(author))
      if (authors.some(id => options.include.authors[id] && options.include.authors[id] <= year)) {
        return true
      }
    }

    return false
  }

  function getDefaultPackageId(entry: IndexerEntry, entryId: EntryID): PackageID {
    const authorName = entry.authors?.at(0) ?? getSourceId(entryId)
    const authorId = getAuthorId(authorName) ?? toID(authorName)
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
        id: ownerId,
        name: await promptAuthorName(entry.authors?.at(0) ?? ownerId),
      }
    }

    return packageId
  }

  async function resolveEntry(entryId: EntryID): Promise<IndexerEntry | undefined> {
    const assetId = getAssetID(entryId)

    let override = getOverride(entryId)

    // Skip ignored entry
    if (override === null || skippedEntries.has(entryId)) {
      console.warn(`Skipping ${assetId}...`)
      return
    }

    const entry = getEntry(entryId)
    const source = getSource(entryId)

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
          skippedEntries.add(entryId)
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
    }

    // Resolve dependencies recursively
    const dependencies = new Set<AssetID | PackageID>()

    if (entry.dependencies) {
      for (const dependencyId of entry.dependencies) {
        if (packages[dependencyId as PackageID]) {
          dependencies.add(dependencyId as PackageID)
        } else {
          const dependencyEntryId = getEntryId(dependencyId)
          const resolvedDependency = await resolveEntry(dependencyEntryId)
          if (resolvedDependency) {
            dependencies.add(resolvedDependency.assetId)
          } else {
            dependencies.add(getAssetID(dependencyEntryId, dependencyId))
          }
        }
      }

      if (!isEqual(entry.dependencies, Array.from(dependencies))) {
        entry.dependencies = Array.from(dependencies)
        entry.meta.timestamp = now
      }
    }

    // Generate packages
    if (entry.variants) {
      for (const variant of keys(entry.variants)) {
        try {
          await registerPackages(entryId, variant)
        } catch (error) {
          console.error(error)
          errors.add((error as Error).message)
        }
      }
    } else {
      try {
        await registerPackages(entryId)
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
    if (!variantEntry.files) {
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

        variantEntry.files = files.map(toPosix).sort()
      } catch (error) {
        console.error(error)
        throw Error(`Failed to extract ${variantAssetId}`)
      }
    }

    // Analyze DBPF contents
    const data = await analyzeSC4Files(downloadPath, variantEntry.files, exemplarProperties)

    variantEntry.buildingFamilies = data.contents.buildingFamilies
    variantEntry.buildings = data.contents.buildings
    variantEntry.features = data.features.length ? data.features : undefined
    variantEntry.lots = data.contents.lots
    variantEntry.mmps = data.contents.mmps
    variantEntry.models = data.contents.models
    variantEntry.propFamilies = data.contents.propFamilies
    variantEntry.props = data.contents.props
    variantEntry.textures = data.contents.textures

    return true
  }

  async function registerPackages(entryId: EntryID, variant?: string): Promise<boolean> {
    const assetId = getAssetID(entryId)
    const entry = getEntry(entryId)
    const source = getSource(entryId)

    const entryOverride = getOverride(entryId)
    const variantOverride = getOverride(entryId, variant)
    const variantAssetId = variant ? (`${assetId}#${variant}` as AssetID) : assetId
    const variantEntry = variant ? entry.variants?.[variant] : entry
    let basePackageId = variantOverride?.packageId ?? entryOverride?.packageId

    if (entryOverride === null || variantOverride === null || !entry.meta?.timestamp) {
      return false
    }

    if (!variantEntry?.files) {
      throw Error(`Missing files for ${variantAssetId}`)
    }

    const downloadUrl = variantEntry.download ?? source?.getDownloadUrl(assetId, variant)

    if (!downloadUrl) {
      throw Error(`Missing download URL for ${variantAssetId}`)
    }

    if (!entry.version) {
      throw Error(`Expected version to exist for ${variantAssetId}`)
    }

    if (!variantOverride) {
      throw Error(`Expected override to exist for ${variantAssetId}`)
    }

    // Create or update asset data
    assets[variantAssetId] = merge(assets[variantAssetId], {
      downloaded: {},
      id: variantAssetId,
      lastModified: entry.lastModified,
      size: variantEntry.size,
      uncompressed: variantEntry.uncompressed,
      url: downloadUrl,
      version: entry.version,
    })

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

    const baseVariantIds = parseStringArray(variantOverride.variantId) as VariantID[]

    const outputs = new Set<string>()
    for (const baseVariantId of baseVariantIds) {
      if (baseVariantId !== "*" && !outputs.has(`${basePackageId}#${baseVariantId}`)) {
        await registerVariant(basePackageId, baseVariantId)
        outputs.add(`${basePackageId}#${baseVariantId}`)
      }
    }

    if (variantOverride.paths) {
      for (const pathOverride of values(variantOverride.paths)) {
        if (pathOverride) {
          const pathPackageId = pathOverride.packageId ?? basePackageId
          const pathVariantIds = parseStringArray(pathOverride?.variantId ?? baseVariantIds)

          for (const pathVariantId of pathVariantIds) {
            if (pathVariantId !== "*" && !outputs.has(`${pathPackageId}#${pathVariantId}`)) {
              await registerVariant(pathPackageId, pathVariantId as VariantID)
              outputs.add(`${pathPackageId}#${pathVariantId}`)
            }
          }
        }
      }
    }

    async function registerVariant(packageId: PackageID, variantId: VariantID) {
      const variantAssetId = variant ? (`${assetId}#${variant}` as AssetID) : assetId
      const variantEntry = variant ? entry.variants?.[variant] : entry
      const variantOverride = getOverride(entryId, variant)

      if (variantOverride === null || !entry.meta?.timestamp) {
        return false
      }

      if (!variantEntry?.files || !entry.version || !variantOverride) {
        throw Error(`Expected override to exist for ${variantAssetId}`)
      }

      packages[packageId] ??= {
        id: packageId,
        name: entry.name ?? packageId,
        status: {},
        variants: {},
      }

      const packageInfo = packages[packageId]
      const variantInfo = packageInfo.variants[variantId]

      if (!variantInfo?.lastGenerated || variantInfo.lastGenerated < entry.meta.timestamp) {
        if (variantInfo) {
          console.debug(`Updating variant ${packageId}#${variantId}...`)
        } else {
          console.debug(`Creating variant ${packageId}#${variantId}...`)
        }

        const filePriorities: { [path in string]?: number } = {}
        let includedPaths: string[]
        let excludedPaths: string[]

        if (variantOverride.paths) {
          includedPaths = []

          function isMatching(pathOverride: IndexerPathOverride): boolean {
            const pathPackageId = pathOverride.packageId ?? basePackageId
            const pathVariantIds = parseStringArray(pathOverride.variantId ?? baseVariantIds)
            return packageId === pathPackageId && containsAny(pathVariantIds, [variantId, "*"])
          }

          let unmatchedFiles = variantEntry.files
          for (const path in variantOverride.paths) {
            const pattern = globToRegex(path)
            const pathOverride = variantOverride.paths[path]

            unmatchedFiles = unmatchedFiles.filter(file => {
              if (pattern.test(file)) {
                if (pathOverride && isMatching(pathOverride)) {
                  includedPaths.push(file)
                  if (pathOverride.override ?? variantOverride.override) {
                    filePriorities[file] = 900
                  }
                }

                return false
              }

              return true
            })
          }

          if (isMatching(variantOverride)) {
            for (const file of unmatchedFiles) {
              includedPaths.push(file)
              if (variantOverride.override) {
                filePriorities[file] = 900
              }
            }
          }

          excludedPaths = difference(variantEntry.files, includedPaths)
        } else {
          includedPaths = variantEntry.files
          excludedPaths = []
        }

        registerVariantAsset(
          packageInfo,
          variantAssetId,
          variantId,
          includedPaths,
          excludedPaths,
          filePriorities,
        )

        generatingPackages[packageId] ??= []
        generatingPackages[packageId].push(variantId)
      }
    }

    return true
  }

  function generateVariant(packageId: PackageID, variantId: VariantID) {
    console.debug(`Generating variant ${packageId}#${variantId}...`)

    const packageInfo = packages[packageId]
    if (!packageInfo) {
      throw Error(`Package ${packageId} does not exist`)
    }

    const variantInfo = packageInfo.variants[variantId]
    if (!variantInfo) {
      throw Error(`Variant ${packageId}#${variantId} does not exist`)
    }

    if (!variantInfo.assets?.length) {
      throw Error(`Variant ${packageId}#${variantId} has no linked assets`)
    }

    const assetEntries = generate<
      VariantAssetInfo,
      AssetID,
      IndexerEntry & {
        asset: VariantAssetInfo
        authors: AuthorID[]
        categories: CategoryID[]
        dependencies: PackageID[]
        files: string[]
      }
    >(variantInfo.assets, asset => {
      if (!assets[asset.id]) {
        throw Error(`Asset ${asset.id} does not exist`)
      }

      const [assetId, variant] = asset.id.split("#", 2) as [AssetID, string?]
      const [entryId, entry] = findEntry(entries, entry => entry.assetId === assetId) ?? []
      if (!entryId || !entry) {
        throw Error(`Asset ${asset.id} has no linked entry`)
      }

      const variantEntry = variant ? entry.variants?.[variant] : entry
      if (!variantEntry) {
        throw Error(`Asset ${asset.id} has no linked entry`)
      }

      if (!variantEntry.files) {
        throw Error(`Entry ${entryId} has no files`)
      }

      const source = getSource(entryId)
      const category = entry.category ? source?.categories?.[entry.category] : undefined

      return [
        asset.id,
        {
          ...entry,
          ...variantEntry,
          asset,
          authors: mapDefined(entry.authors ?? [], getAuthorId),
          categories: union(entry.categories ?? [], category?.categories ?? []),
          dependencies: mapDefined(entry.dependencies ?? [], dependencyId => {
            if (packages[dependencyId as PackageID]) {
              return dependencyId as PackageID
            }

            return getOverride(getEntryId(dependencyId))?.packageId
          }),
          files: variantEntry.files,
        },
      ]
    })

    generateVariantInfo(packageInfo, variantInfo, assetEntries, categories)
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

    return findKey(
      dbAuthors,
      (author, authorId) =>
        authorId === rawId ||
        author.name.toLowerCase() === lowercased ||
        !!author.alias?.some(alias => alias.toLowerCase() === lowercased),
    )
  }
}

function getExePath(exe: string): string {
  return process.env[`INDEXER_EXE_PATH_${exe.toUpperCase()}`] || exe
}

async function loadExemplarProperties(): Promise<{ [id: number]: ExemplarPropertyInfo }> {
  console.debug("Loading exemplar properties...")
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

async function loadAuthorsFromDB(): Promise<{ [authorId in AuthorID]?: AuthorInfo }> {
  console.debug("Loading authors...")
  const config = await loadConfig<{ [authorId: AuthorID]: AuthorData }>(dbDir, "authors")
  return mapValues(config?.data ?? {}, (data, id) => loadAuthorInfo(id, data))
}

async function loadCategories(): Promise<Categories> {
  console.debug("Loading categories...")
  const config = await loadConfig<Categories>(dbDir, "configs/categories")
  return config?.data ?? {}
}

async function loadAssetsFromDB(): Promise<Assets> {
  const assets: Assets = {}

  const filePaths = await glob("*.yaml", { cwd: dbAssetsDir })
  for (const filePath of filePaths.reverse()) {
    const sourceId = path.basename(filePath, path.extname(filePath)) as IndexerSourceID
    console.debug(`Loading assets from ${sourceId}...`)
    const fullPath = path.join(dbAssetsDir, filePath)
    const data = await readConfig<{ [assetId in AssetID]?: AssetData }>(fullPath)
    forEach(data, (assetData, assetId) => {
      assets[assetId] = loadAssetInfo(assetId, assetData)
    })
  }

  return assets
}

async function loadPackagesFromDB(categories: Categories): Promise<Packages> {
  const packages: Packages = {}

  const filePaths = await glob("*.yaml", { cwd: dbPackagesDir, nodir: true })
  for (const filePath of filePaths.reverse()) {
    const authorId = path.basename(filePath, path.extname(filePath))
    console.debug(`Loading packages from ${authorId}...`)
    const fullPath = path.join(dbPackagesDir, filePath)
    const data = await readConfig<{ [packageId in PackageID]?: PackageData }>(fullPath)
    forEach(data, (packageData, packageId) => {
      packages[packageId] = loadPackageInfo(packageId, packageData, categories)
    })
  }

  return packages
}

function getEntryId(assetId: string): EntryID {
  return (assetId.match(/^([a-z0-9-]+[/]\d+)(-[^/]*)?$/)?.[1] ?? assetId) as EntryID
}

function getSourceId(assetId: AssetID | EntryID): IndexerSourceID {
  return assetId.split("/")[0] as IndexerSourceID
}
