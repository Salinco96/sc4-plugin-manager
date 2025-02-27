import {
  collect,
  difference,
  forEach,
  intersection,
  mapKeys,
  mapValues,
  matchGroups,
  merge,
  reduce,
  remove,
  toArray,
  union,
  unionBy,
  values,
  where,
} from "@salinco/nice-utils"

import type { AssetID } from "@common/assets"
import type { AuthorID } from "@common/authors"
import { type Categories, CategoryID } from "@common/categories"
import { type PackageID, getOwnerId } from "@common/packages"
import type { PackageInfo } from "@common/types"
import type { VariantAssetInfo, VariantID, VariantInfo } from "@common/variants"
import {
  CLEANITOL_EXTENSIONS,
  DOC_EXTENSIONS,
  README_EXTENSIONS,
  SC4_EXTENSIONS,
  matchFiles,
} from "@node/data/files"
import { getExtension } from "@node/files"

import path from "node:path"
import { loadVariantContentsInfo } from "@node/data/packages"
import type { IndexerEntry } from "../types"
import { htmlToMd } from "../utils"

// Common dependencies for which URL detection will not be accurate (e.g. BSC Common Dependencies Pack)
const commonDependencies: {
  [packageId in string]: RegExp
} = {
  "bsc/essentials": /bsc essentials/i,
  "bsc/textures-vol01": /bsc textures vol ?0?1/i,
  "bsc/textures-vol02": /bsc textures vol ?0?2/i,
  "bsc/textures-vol03": /bsc textures vol ?0?3/i,
  "cycledogg/mega-props-vol01": /mega props (- )?cp vol ?0?1/i,
  "cycledogg/mega-props-vol02": /mega props (- )?cp vol ?0?2/i,
  "deadwoods/mega-props-vol01": /mega props (- )?(dae|dedwd) vol ?0?1/i,
  "deadwoods/mega-props-vol02": /mega props (- )?(dae|dedwd) vol ?0?2/i,
  "dolphin66/mega-props-vol01": /mega props (- )?d66 vol ?0?1/i,
  "dolphin66/mega-props-vol02": /mega props (- )?d66 vol ?0?2/i,
  "dolphin66/mega-props-vol03": /mega props (- )?d66 vol ?0?3/i,
  "gascooker/mega-props-vol01": /mega props (- )?gascooker vol ?0?1/i,
  "gascooker/mega-props-vol02": /mega props (- )?gascooker vol ?0?2/i,
  "girafe/carpack": /gi?ra?fe(-vnaoned)? (car|urban)pack/i,
  "girafe/hedges": /gi?ra?fe (le )?hedges/i,
  "jestarr/mega-props-vol01": /mega props (- )?jes vol ?0?1/i,
  "jestarr/mega-props-vol02": /mega props (- )?jes vol ?0?2/i,
  "jestarr/mega-props-vol03": /mega props (- )?jes vol ?0?3/i,
  "jestarr/mega-props-vol04": /mega props (- )?jes vol ?0?4/i,
  "jestarr/mega-props-vol05": /mega props (- )?jes vol ?0?5/i,
  "jestarr/mega-props-vol06": /mega props (- )?jes vol ?0?6/i,
  "jestarr/mega-props-vol07": /mega props (- )?jes vol ?0?7/i,
  "jestarr/mega-props-vol08": /mega props (- )?jes vol ?0?8/i,
  "jestarr/mega-props-vol09": /mega props (- )?jes vol ?0?9/i,
  "simgoober/mega-props-vol01": /mega props (- )?sg vol ?0?1/i,
  "swi21/mega-props-vol01": /mega props (- )?swi21 vol ?0?1/i,
  "swi21/mega-props-vol02": /mega props (- )?swi21 vol ?0?2/i,
}

export function extractDependencies(html: string): string[] {
  const dependencies = new Set<string>()

  // Simtropolis file page URL
  for (const match of html.matchAll(
    /(https:[/][/]community[.]simtropolis[.]com)?[/]files[/]file[/]([\w-]+)[/]?/g,
  )) {
    dependencies.add(`simtropolis/${match[2]}`)
  }

  // SC4Evermore file page URL
  for (const match of html.matchAll(
    /(https:[/][/]www[.]sc4evermore[.]com)?[/]index[.]php[/]downloads[/]download[/]([\w-]+[/])?([\w-]+)[/]?/g,
  )) {
    dependencies.add(`sc4evermore/${match[3]}`)
  }

  for (const packageId in commonDependencies) {
    if (commonDependencies[packageId].test(html)) {
      dependencies.add(packageId)
    }
  }

  return Array.from(dependencies)
}

export function extractRepositoryUrl(html: string): string | undefined {
  // We hardcode a few known GitHub users not to pick up random repositories
  const match = html.match(/https:[/][/]github[.]com[/](0xC0000054|memo33|nsgomez)[/]([\w-]+)?/g)
  return match?.[0]
}

export function extractSupportUrl(html: string): string | undefined {
  const match = html.match(
    /https:[/][/]community[.]simtropolis[.]com[/]forums[/]topic[/](?!762980)([\w-]+)?/g,
  )
  return match?.[0]
}

export function registerVariantAsset(
  packageInfo: PackageInfo,
  assetId: AssetID,
  variantId: VariantID,
  includedPaths: string[],
  excludedPaths: string[],
  filePriorities: { [path in string]?: number },
): void {
  packageInfo.variants[variantId] ??= {
    authors: [getOwnerId(packageInfo.id)],
    categories: [],
    id: variantId,
    priority: 0, // unused by indexer
    version: "0.0.0",
  }

  const variantInfo = packageInfo.variants[variantId]
  const isNewVariant = !variantInfo.lastGenerated

  variantInfo.assets ??= []

  let variantAsset = variantInfo.assets.find(where("id", assetId))

  if (!variantAsset) {
    variantAsset = { id: assetId }
    variantInfo.assets.push(variantAsset)
  }

  const includedDocPaths = includedPaths.filter(path => DOC_EXTENSIONS.includes(getExtension(path)))
  const excludedDocPaths = excludedPaths.filter(path => DOC_EXTENSIONS.includes(getExtension(path)))
  const includedSC4Paths = includedPaths.filter(path => SC4_EXTENSIONS.includes(getExtension(path)))
  const excludedSC4Paths = excludedPaths.filter(path => SC4_EXTENSIONS.includes(getExtension(path)))

  // Cleanitol files which are already included
  const { matchedPaths: includedCleanitolFiles, unmatchedPaths: unmatchedTxtPaths } = matchFiles(
    includedDocPaths.filter(path => CLEANITOL_EXTENSIONS.includes(getExtension(path))),
    {
      exclude: variantAsset.exclude ?? [],
      include: variantAsset.cleanitol?.map(path => ({ path })) ?? [],
    },
  )

  // Cleanitol files which are not included but should be
  const { matchedPaths: newCleanitolFiles } = matchFiles(unmatchedTxtPaths, {
    exclude: variantAsset.exclude ?? [],
    ignoreEmpty: true,
    include: [{ path: "*cleanitol*.txt" }],
  })

  // Cleanitol files which are included but should not be
  const { matchedPaths: wronglyIncludedCleanitolFiles } = matchFiles(
    excludedDocPaths.filter(path => CLEANITOL_EXTENSIONS.includes(getExtension(path))),
    {
      exclude: variantAsset.exclude ?? [],
      ignoreEmpty: true,
      include: variantAsset.cleanitol?.map(path => ({ path })) ?? [{ path: "*cleanitol*.txt" }],
    },
  )

  // Cleanitol files which should be excluded
  const { matchedPaths: excludedCleanitolFiles } = matchFiles(excludedDocPaths, {
    ignoreEmpty: true,
    include: [{ path: "*cleanitol*.txt" }],
  })

  // Doc files which are already included
  const { matchedPaths: includedDocFiles, unmatchedPaths: unmatchedDocPaths } = matchFiles(
    includedDocPaths.filter(path => !includedCleanitolFiles[path] && !newCleanitolFiles[path]),
    {
      exclude: variantAsset.exclude ?? [],
      include: variantAsset.docs ?? [],
    },
  )

  // Doc files which are included but should not be
  const { matchedPaths: wronglyIncludedDocFiles } = matchFiles(
    excludedDocPaths.filter(path => !wronglyIncludedCleanitolFiles[path]),
    {
      exclude: variantAsset.exclude ?? [],
      ignoreEmpty: true,
      include: variantAsset.docs ?? [],
    },
  )

  // Plugin files which are already included
  const { matchedPaths: includedSC4Files, unmatchedPaths: unmatchedSC4Paths } = matchFiles(
    includedSC4Paths,
    {
      exclude: variantAsset.exclude ?? [],
      include: variantAsset.include ?? [],
      options: variantInfo.options,
    },
  )

  // Plugin files which are included but should not be
  const { matchedPaths: wronglyIncludedSC4Files } = matchFiles(excludedSC4Paths, {
    exclude: variantAsset.exclude ?? [],
    ignoreEmpty: true,
    include: variantAsset.include ?? [],
    options: variantInfo.options,
  })

  if (values(excludedCleanitolFiles).some(Boolean)) {
    variantAsset.cleanitol ??= []
  }

  if (values(newCleanitolFiles).some(Boolean)) {
    variantAsset.cleanitol ??= []
    for (const path in newCleanitolFiles) {
      if (newCleanitolFiles[path]) {
        variantAsset.cleanitol.push(path)
      }
    }
  }

  if (excludedDocPaths.length) {
    variantAsset.docs ??= []
  }

  if (unmatchedDocPaths.length && (variantAsset.docs || isNewVariant)) {
    variantAsset.docs ??= []
    for (const oldPath of unmatchedDocPaths) {
      variantAsset.docs.push({ path: oldPath })
      includedDocFiles[oldPath] = { path: path.basename(oldPath) }
    }
  }

  if (excludedSC4Paths.length) {
    variantAsset.include ??= []

    if (isNewVariant) {
      variantAsset.exclude ??= []
      for (const oldPath of excludedSC4Paths) {
        variantAsset.exclude.push(oldPath)
      }
    }
  }

  if (unmatchedSC4Paths.length && (variantAsset.include || isNewVariant)) {
    variantAsset.include ??= []
    for (const oldPath of unmatchedSC4Paths) {
      const priority = filePriorities[oldPath]
      variantAsset.include.push({ path: oldPath, priority })
      includedSC4Files[oldPath] = { path: path.basename(oldPath), priority }
    }
  }

  if (values(wronglyIncludedCleanitolFiles).some(Boolean)) {
    variantAsset.exclude ??= []
    for (const path in wronglyIncludedCleanitolFiles) {
      if (wronglyIncludedCleanitolFiles[path]) {
        console.warn(`File ${path} should not be included.`)
        variantAsset.exclude.push(path)
      }
    }
  }

  if (values(wronglyIncludedDocFiles).some(Boolean)) {
    variantAsset.exclude ??= []
    for (const path in wronglyIncludedDocFiles) {
      if (wronglyIncludedDocFiles[path]) {
        console.warn(`File ${path} should not be included.`)
        variantAsset.exclude.push(path)
      }
    }
  }

  if (values(wronglyIncludedSC4Files).some(Boolean)) {
    variantAsset.exclude ??= []
    for (const path in wronglyIncludedSC4Files) {
      if (wronglyIncludedSC4Files[path]) {
        console.warn(`File ${path} should not be included.`)
        variantAsset.exclude.push(path)
      }
    }
  }
}

export function generateVariantInfo(
  packageInfo: PackageInfo,
  variantInfo: VariantInfo,
  entries: {
    [assetId in AssetID]?: IndexerEntry & {
      asset: VariantAssetInfo
      authors: AuthorID[]
      categories: CategoryID[]
      dependencies: PackageID[]
      files: string[]
    }
  },
  categories: Categories,
): void {
  if (!variantInfo.assets?.length) {
    throw Error(`Variant ${packageInfo.id}#${variantInfo.id} has no linked assets`)
  }

  const mainAsset = variantInfo.assets[0]
  const mainEntry = entries[mainAsset.id]
  if (!mainEntry?.version) {
    throw Error(`Variant ${packageInfo.id}#${variantInfo.id} has no version`)
  }

  const [major, minor, patch] = matchGroups(mainEntry.version, /(\d+)(?:[.](\d+)(?:[.](\d+))?)?/)
  const version = `${major}.${minor ?? 0}.${patch ?? 0}`

  const isNewRelease = variantInfo.version === "0.0.0"
  const isNewVersion = variantInfo.version !== version

  variantInfo.lastGenerated = new Date()
  variantInfo.version = version

  if (isNewRelease) {
    variantInfo.release = new Date()
  }

  if (mainEntry.description && isNewVersion) {
    variantInfo.description = htmlToMd(mainEntry.description)
  }

  // Fields derived from main entry only
  variantInfo.deprecated ??= mainEntry.category?.includes("obsolete")
  variantInfo.logs = mainEntry.description?.match(/\b[\w-]+[.]log\b/)?.at(0) ?? variantInfo.logs
  variantInfo.repository = mainEntry.repository ?? variantInfo.repository
  variantInfo.support = mainEntry.support ?? variantInfo.support
  variantInfo.thumbnail = mainEntry.thumbnail ?? variantInfo.thumbnail
  variantInfo.url = mainEntry.url ?? variantInfo.url

  const features = new Set(packageInfo.features)
  const variantCategories = new Set(variantInfo.categories)

  const includedCleanitolPaths = new Set<string>()
  const includedDocPaths = new Set<string>()
  const includedSC4Paths = new Set<string>()
  const translatePaths: { [assetId in AssetID]?: { [oldPath in string]?: string } } = {}

  forEach(entries, (entry, assetId) => {
    for (const category of entry.categories) {
      variantCategories.add(category)
    }

    if (entry.features) {
      for (const feature of entry.features) {
        features.add(feature)
      }
    }

    const { asset, files } = entry

    const { matchedPaths: cleanitolFiles } = matchFiles(
      files.filter(path => CLEANITOL_EXTENSIONS.includes(getExtension(path))),
      {
        exclude: asset.exclude,
        ignoreEmpty: !asset.cleanitol,
        include: asset.cleanitol?.map(path => ({ path })) ?? [{ path: "*cleanitol*.txt" }],
      },
    )

    forEach(cleanitolFiles, async (file, oldPath) => {
      if (file) {
        if (includedCleanitolPaths.has(file.path)) {
          console.error(`Ignoring file ${oldPath} trying to unpack at ${file.path}`)
        } else {
          includedCleanitolPaths.add(file.path)
          translatePaths[assetId] ??= {}
          translatePaths[assetId][oldPath] = file.path
        }
      }
    })

    const { matchedPaths: docFiles } = matchFiles(
      files.filter(path => DOC_EXTENSIONS.includes(getExtension(path)) && !cleanitolFiles[path]),
      {
        exclude: asset.exclude,
        ignoreEmpty: !asset.docs,
        include: asset.docs ?? [{ path: "" }],
      },
    )

    forEach(docFiles, async (file, oldPath) => {
      if (file) {
        if (includedDocPaths.has(file.path)) {
          console.error(`Ignoring file ${oldPath} trying to unpack at ${file.path}`)
        } else {
          includedDocPaths.add(file.path)
          translatePaths[assetId] ??= {}
          translatePaths[assetId][oldPath] = file.path
        }
      }
    })

    const { matchedPaths: sc4Files } = matchFiles(
      files.filter(path => SC4_EXTENSIONS.includes(getExtension(path))),
      {
        exclude: asset.exclude,
        ignoreEmpty: !asset.include,
        include: asset.include ?? [{ path: "" }],
        options: variantInfo.options,
      },
    )

    forEach(sc4Files, async (file, oldPath) => {
      if (file) {
        if (includedSC4Paths.has(file.path)) {
          console.error(`Ignoring file ${oldPath} trying to unpack at ${file.path}`)
        } else {
          includedSC4Paths.add(file.path)
          translatePaths[assetId] ??= {}
          translatePaths[assetId][oldPath] = file.path
          if (getExtension(file.path) === ".dll") {
            variantCategories.add(CategoryID.DLL)
          }
        }
      }
    })
  })

  if (variantCategories.has(CategoryID.DEPENDENCIES)) {
    if (packageInfo.id.includes("props")) {
      variantCategories.add(CategoryID.PROPS)
    }

    if (packageInfo.id.includes("textures")) {
      variantCategories.add(CategoryID.TEXTURES)
    }
  }

  // Last modified (latest of all entries)
  const lastModified = collect(entries, entry => entry.lastModified.valueOf())
  variantInfo.lastModified = new Date(Math.max(...lastModified))

  const authors = values(entries).flatMap(entry => entry.authors)
  const dependencies = values(entries).flatMap(entry => entry.dependencies ?? [])
  const images = values(entries).flatMap(entry => entry.images ?? [])

  variantInfo.authors = union(variantInfo.authors, authors)

  variantInfo.dependencies = unionBy(
    variantInfo.dependencies ?? [],
    difference(remove(dependencies, packageInfo.id), variantInfo.optional ?? []).map(id => ({
      id,
      transitive: true,
    })),
    dependency => dependency.id,
  )

  variantInfo.images = union(variantInfo.images ?? [], images)

  if (variantInfo.id.includes("darknite")) {
    variantInfo.requirements ??= {}
    variantInfo.requirements.darknite = true

    for (const other of values(packageInfo.variants)) {
      if (!other.id.includes("darknite") && !other.requirements?.darknite) {
        if (other.id === "default") {
          other.name ??= "Maxis Nite"
        }

        other.requirements ??= {}
        other.requirements.darknite = false
      }
    }
  }

  switch (variantInfo.id) {
    case "darknite-hd": {
      variantInfo.name ??= "Dark Nite (HD)"
      break
    }

    case "darknite-sd": {
      variantInfo.name ??= "Dark Nite (SD)"
      break
    }

    case "darknite": {
      variantInfo.name ??= "Dark Nite"
      break
    }

    case "hd": {
      variantInfo.name ??= "HD"
      break
    }

    case "sd": {
      variantInfo.name ??= "SD"
      break
    }
  }

  const docPaths = toArray(includedDocPaths)
  const readmePaths = docPaths.filter(path => README_EXTENSIONS.includes(getExtension(path)))
  variantInfo.readme = union(intersection(variantInfo.readme ?? [], docPaths), readmePaths)

  const contents = mapValues(entries, entry =>
    loadVariantContentsInfo(
      {
        buildingFamilies:
          entry.buildingFamilies &&
          mapKeys(
            entry.buildingFamilies,
            oldPath => translatePaths[entry.asset.id]?.[oldPath] ?? null,
          ),
        buildings:
          entry.buildings &&
          mapKeys(entry.buildings, oldPath => translatePaths[entry.asset.id]?.[oldPath] ?? null),
        lots:
          entry.lots &&
          mapKeys(entry.lots, oldPath => translatePaths[entry.asset.id]?.[oldPath] ?? null),
        mmps:
          entry.mmps &&
          mapKeys(entry.mmps, oldPath => translatePaths[entry.asset.id]?.[oldPath] ?? null),
        models:
          entry.models &&
          mapKeys(entry.models, oldPath => translatePaths[entry.asset.id]?.[oldPath] ?? null),
        propFamilies:
          entry.propFamilies &&
          mapKeys(entry.propFamilies, oldPath => translatePaths[entry.asset.id]?.[oldPath] ?? null),
        props:
          entry.props &&
          mapKeys(entry.props, oldPath => translatePaths[entry.asset.id]?.[oldPath] ?? null),
        textures:
          entry.textures &&
          mapKeys(entry.textures, oldPath => translatePaths[entry.asset.id]?.[oldPath] ?? null),
      },
      categories,
    ),
  )

  variantInfo.buildingFamilies = mergeItems(
    variantInfo.buildingFamilies?.filter(
      instance => instance.file && includedSC4Paths.has(instance.file),
    ) ?? [],
    values(contents).flatMap(content => content.buildingFamilies ?? []),
    isSame(instance => `${instance.file}:${instance.id}`),
  )

  variantInfo.buildings = mergeItems(
    variantInfo.buildings?.filter(instance => includedSC4Paths.has(instance.file)) ?? [],
    values(contents).flatMap(content => content.buildings ?? []),
    isSame(instance => `${instance.file}:${instance.id}`),
  )

  variantInfo.lots = mergeItems(
    variantInfo.lots?.filter(instance => includedSC4Paths.has(instance.file)) ?? [],
    values(contents).flatMap(content => content.lots ?? []),
    isSame(instance => `${instance.file}:${instance.id}`),
  )

  variantInfo.mmps = mergeItems(
    variantInfo.mmps?.filter(instance => includedSC4Paths.has(instance.file)) ?? [],
    values(contents).flatMap(content => content.mmps ?? []),
    isSame(instance => `${instance.file}:${instance.id}`),
  )

  variantInfo.models = reduce(contents, (models, entry) => ({ ...models, ...entry.models }), {})

  variantInfo.propFamilies = mergeItems(
    variantInfo.propFamilies?.filter(
      instance => instance.file && includedSC4Paths.has(instance.file),
    ) ?? [],
    values(contents).flatMap(content => content.propFamilies ?? []),
    isSame(instance => `${instance.file}:${instance.id}`),
  )

  variantInfo.props = mergeItems(
    variantInfo.props?.filter(instance => includedSC4Paths.has(instance.file)) ?? [],
    values(contents).flatMap(content => content.props ?? []),
    isSame(instance => `${instance.file}:${instance.id}`),
  )

  variantInfo.textures = reduce(
    contents,
    (textures, entry) => ({ ...textures, ...entry.textures }),
    {},
  )

  for (const building of variantInfo.buildings) {
    if (building.categories && variantInfo.lots.some(lot => lot.building === building.id)) {
      for (const category of building.categories) {
        variantCategories.add(category)
      }
    }
  }

  for (const lot of variantInfo.lots) {
    if (lot.requirements?.cam) {
      variantCategories.add(CategoryID.CAM)
    }
  }

  if (variantInfo.mmps.length) {
    variantCategories.add(CategoryID.MMPS)
  }

  if (!variantCategories.size) {
    variantCategories.add(CategoryID.MODS)
  }

  variantInfo.categories = toArray(variantCategories)
  packageInfo.features = toArray(features)
}

function isSame<T, R>(fn: (value: T) => R): (value: T, other: T) => boolean {
  return (value, other) => fn(value) === fn(other)
}

function mergeItems<T>(
  values: readonly T[],
  others: readonly T[],
  compareFn: (value: T, other: T) => boolean,
  mergeFn: (value: T, other: T) => T = merge,
): T[] {
  return [...values, ...others].reduce<T[]>((result, other) => {
    const index = result.findIndex(value => compareFn(value, other))

    if (index < 0) {
      result.push(other)
    } else {
      result[index] = mergeFn(result[index], other)
    }

    return result
  }, [])
}
