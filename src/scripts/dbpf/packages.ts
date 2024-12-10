import path from "node:path"

import {
  collect,
  difference,
  entries,
  get,
  groupBy,
  matchGroups,
  toArray,
  union,
  unionBy,
  where,
} from "@salinco/nice-utils"

import type { AssetID } from "@common/assets"
import type { AuthorID } from "@common/authors"
import { type Categories, CategoryID } from "@common/categories"
import type { PackageID } from "@common/packages"
import type { PackageInfo } from "@common/types"
import type { DependencyInfo, VariantID } from "@common/variants"
import { loadBuildingInfo } from "@node/data/buildings"
import { loadFamilyInfo } from "@node/data/families"
import { loadLotInfo } from "@node/data/lots"
import { loadFloraInfo } from "@node/data/mmps"
import type { FileData } from "@node/data/packages"
import { loadPropInfo } from "@node/data/props"
import { getExtension } from "@node/files"

import type { IndexerEntry, IndexerSource } from "../types"
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

export function generatePackageInfo(
  packageInfo: PackageInfo,
  packageId: PackageID,
  assetId: AssetID,
  source: IndexerSource | undefined,
  entry: IndexerEntry,
  variant: string | undefined,
  variantId: VariantID,
  includedFiles: string[],
  excludedFiles: string[],
  packageFiles: { [path in string]?: FileData },
  authors: AuthorID[],
  dependencies: PackageID[],
  categories: Categories,
  timestamp: Date,
): PackageInfo {
  const variantAssetId = variant ? (`${assetId}#${variant}` as AssetID) : assetId
  const variantEntry = variant ? entry.variants?.[variant] : entry
  if (!variantEntry || !entry.version) {
    throw Error(`Expected override to exist for ${variantAssetId}`)
  }

  const [major, minor, patch] = matchGroups(entry.version, /(\d+)(?:[.](\d+)(?:[.](\d+))?)?/)
  const version = `${major}.${minor ?? 0}.${patch ?? 0}`

  packageInfo.variants[variantId] ??= {
    authors,
    categories: [],
    id: variantId,
    priority: 0, // unused by indexer
    release: timestamp,
    version,
  }

  const variantInfo = packageInfo.variants[variantId]

  if (variantInfo.version !== version) {
    variantInfo.release = timestamp
    variantInfo.version = version

    if (entry.description) {
      variantInfo.description = htmlToMd(entry.description)
    }
  }

  const variantCategories = new Set(variantInfo.categories)

  if (variantEntry.categories) {
    for (const category of variantEntry.categories) {
      variantCategories.add(category)
    }
  }

  if (source && entry.category) {
    const defaultCategories = source.categories[entry.category]?.categories
    if (defaultCategories) {
      for (const category of defaultCategories) {
        variantCategories.add(category)
      }
    }
  }

  if (variantCategories.has(CategoryID.DEPENDENCIES)) {
    if (packageId.includes("props")) {
      variantCategories.delete(CategoryID.DEPENDENCIES)
      variantCategories.add(CategoryID.PROPS)
    }

    if (packageId.includes("textures")) {
      variantCategories.delete(CategoryID.DEPENDENCIES)
      variantCategories.add(CategoryID.TEXTURES)
    }
  }

  if (!variantCategories.size) {
    variantCategories.add(CategoryID.MODS)
  }

  variantInfo.assets ??= []
  variantInfo.categories = toArray(variantCategories)
  variantInfo.lastGenerated = timestamp
  variantInfo.lastModified = entry.lastModified
  variantInfo.logs ??= entry.description?.match(/\b[\w-]+[.]log\b/)?.at(0)

  const extraFeatures = variantEntry.features?.filter(
    feature => !packageInfo.features?.includes(feature),
  )

  if (extraFeatures?.length) {
    console.warn(
      `Variant ${variantId} contains features ${extraFeatures.join(",")} which are not included in the default variant. All variants must include the same feature set.`,
    )
  }

  const variantAuthors = union(variantInfo.authors ?? [], authors)

  const variantDependencies: DependencyInfo[] = unionBy(
    variantInfo.dependencies ?? [],
    difference(dependencies, variantInfo.optional ?? []).map(id => ({ id, transitive: true })),
    get("id"),
  )

  const variantImages = union(variantInfo.images ?? [], entry.images ?? [])

  variantInfo.authors = variantAuthors
  variantInfo.dependencies = variantDependencies
  variantInfo.images = variantImages
  variantInfo.thumbnail = entry.thumbnail
  variantInfo.url = entry.url

  variantInfo.repository ??= entry.repository
  variantInfo.support ??= entry.support

  if (entry.category?.includes("obsolete")) {
    variantInfo.deprecated = true
  }

  if (variantId === "darknite") {
    variantInfo.name ??= "Dark Nite"
    variantInfo.requirements ??= {}
    variantInfo.requirements.darknite = true

    const defaultVariantData = packageInfo.variants["default" as VariantID]
    if (defaultVariantData) {
      defaultVariantData.name ??= "Maxis Nite"
      defaultVariantData.requirements ??= {}
      defaultVariantData.requirements.darknite = false
    }
  }

  let variantAsset = variantInfo.assets.find(where("id", variantAssetId))

  if (!variantAsset) {
    variantAsset = { id: variantAssetId }
    variantInfo.assets.push(variantAsset)
  }

  const {
    sc4: includedSC4Files,
    cleanitol: includedCleanitolFiles,
    docs: includedDocFiles,
  } = categorizeFiles(includedFiles)

  const {
    sc4: excludedSC4Files,
    cleanitol: excludedCleanitolFiles,
    docs: excludedDocFiles,
  } = categorizeFiles(excludedFiles)

  if (includedCleanitolFiles?.length) {
    variantAsset.cleanitol = includedCleanitolFiles
  } else if (excludedCleanitolFiles?.length) {
    variantAsset.cleanitol = []
  }

  if (includedDocFiles?.length) {
    variantAsset.docs = includedDocFiles.map(path => ({ path }))
  } else if (excludedDocFiles?.length) {
    variantAsset.docs = []
  }

  if (includedSC4Files?.length) {
    variantAsset.include = includedSC4Files.map(path => packageFiles[path] ?? { path })
  } else if (excludedSC4Files?.length) {
    variantAsset.include = []
  }

  if (variantEntry.buildingFamilies) {
    variantInfo.buildingFamilies = unionBy(
      variantInfo.buildingFamilies ?? [],
      entries(variantEntry.buildingFamilies)
        .filter(([file]) => includedFiles.includes(file))
        .flatMap(([file, instances]) =>
          collect(instances, (data, id) => loadFamilyInfo(file, id, data)),
        ),
      instance => `${instance.id}:${instance.file}`,
    )
  }

  if (variantEntry.buildings) {
    variantInfo.buildings = unionBy(
      variantInfo.buildings ?? [],
      entries(variantEntry.buildings)
        .filter(([file]) => includedFiles.includes(file))
        .flatMap(([file, instances]) =>
          collect(instances, (data, id) => loadBuildingInfo(file, id, data, categories)),
        ),
      instance => `${instance.id}:${instance.file}`,
    )
  }

  if (variantEntry.lots) {
    variantInfo.lots = unionBy(
      variantInfo.lots ?? [],
      entries(variantEntry.lots)
        .filter(([file]) => includedFiles.includes(file))
        .flatMap(([file, instances]) =>
          collect(instances, (data, id) => loadLotInfo(file, id, data)),
        ),
      instance => `${instance.id}:${instance.file}`,
    )
  }

  if (variantEntry.mmps) {
    variantInfo.mmps = unionBy(
      variantInfo.mmps ?? [],
      entries(variantEntry.mmps)
        .filter(([file]) => includedFiles.includes(file))
        .flatMap(([file, instances]) =>
          collect(instances, (data, id) => loadFloraInfo(file, id, data)),
        ),
      instance => `${instance.id}:${instance.file}`,
    )
  }

  if (variantEntry.propFamilies) {
    variantInfo.propFamilies = unionBy(
      variantInfo.propFamilies ?? [],
      entries(variantEntry.propFamilies)
        .filter(([file]) => includedFiles.includes(file))
        .flatMap(([file, instances]) =>
          collect(instances, (data, id) => loadFamilyInfo(file, id, data)),
        ),
      instance => `${instance.id}:${instance.file}`,
    )
  }

  if (variantEntry.props) {
    variantInfo.props = unionBy(
      variantInfo.props ?? [],
      entries(variantEntry.props)
        .filter(([file]) => includedFiles.includes(file))
        .flatMap(([file, instances]) =>
          collect(instances, (data, id) => loadPropInfo(file, id, data)),
        ),
      instance => `${instance.id}:${instance.file}`,
    )
  }

  return packageInfo
}

const sc4Extensions = [".dat", ".dll", ".ini", "._loosedesc", ".sc4desc", ".sc4lot", ".sc4model"]

function categorizeFiles(files: string[]) {
  return groupBy(files, file => {
    if (sc4Extensions.includes(getExtension(file))) {
      return "sc4"
    }

    if (path.basename(file).match(/(cleanitol|remove).*[.]txt$/i)) {
      return "cleanitol"
    }

    return "docs"
  })
}
