import path from "node:path"

import type { AssetID } from "@common/assets"
import type { AuthorID } from "@common/authors"
import { CategoryID } from "@common/categories"
import type { PackageID } from "@common/packages"
import type { PackageData } from "@common/types"
import { groupBy, union } from "@common/utils/arrays"
import { isString } from "@common/utils/types"
import type { VariantID } from "@common/variants"
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
    /(https:[/][/]www[.]sc4evermore[.]com)?[/]index[.]php[/]downloads[/]download[/][\w-]+[/]([\w-]+)[/]?/g,
  )) {
    dependencies.add(`sc4evermore/${match[2]}`)
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

export function writePackageData(
  packageData: PackageData,
  packageId: PackageID,
  assetId: AssetID,
  source: IndexerSource | undefined,
  entry: IndexerEntry,
  variant: string | undefined,
  variantId: VariantID,
  includedFiles: string[],
  excludedFiles: string[],
  authors: AuthorID[],
  dependencies: PackageID[],
  timestamp: Date,
): PackageData {
  const variantAssetId = variant ? (`${assetId}#${variant}` as AssetID) : assetId
  const variantEntry = variant ? entry.variants?.[variant] : entry
  if (!variantEntry || !entry.version) {
    throw Error(`Expected override to exist for ${variantAssetId}`)
  }

  packageData.variants ??= {}
  packageData.variants[variantId] ??= {}
  const variantData = packageData.variants[variantId]

  const [, major, minor, patch] = entry.version.match(/(\d+)(?:[.](\d+)(?:[.](\d+))?)?/)!

  const categories = new Set(packageData.category?.split(","))

  if (source && entry.category) {
    const defaultCategories = source.categories[entry.category]?.category
    if (defaultCategories) {
      for (const category of defaultCategories.split(",")) {
        categories.add(category)
      }
    }
  }

  if (categories.has(CategoryID.DEPENDENCIES)) {
    if (packageId.includes("props")) {
      categories.delete(CategoryID.DEPENDENCIES)
      categories.add(CategoryID.PROPS)
    }

    if (packageId.includes("textures")) {
      categories.delete(CategoryID.DEPENDENCIES)
      categories.add(CategoryID.TEXTURES)
    }
  }

  if (!categories.size) {
    categories.add(CategoryID.MODS)
  }

  packageData.category ??= Array.from(categories).join(",")

  packageData.name ??= entry.name

  variantData.assets ??= []
  variantData.lastModified = entry.lastModified
  variantData.logs ??= entry.description?.match(/\b[\w-]+[.]log\b/)?.[0]
  variantData.release = timestamp
  variantData.version = `${major}.${minor ?? 0}.${patch ?? 0}`

  if (variantId === "default" || !packageData.url || packageData.url === entry.url) {
    const packageAuthors = union(authors, packageData.authors ?? [])

    const packageDependencies = union(dependencies, packageData.dependencies ?? [])

    const packageDescription = entry.description
      ? htmlToMd(entry.description)
      : packageData.description

    const packageFeatures = union(variantEntry.features ?? [], packageData.features ?? [])

    const packageImages = union(entry.images ?? [], packageData.images ?? [])

    packageData.authors = packageAuthors.length ? packageAuthors.sort() : undefined
    packageData.dependencies = packageDependencies.length ? packageDependencies.sort() : undefined
    packageData.description = packageDescription
    packageData.features = packageFeatures.length ? packageFeatures.sort() : undefined
    packageData.images = packageImages.length ? packageImages : undefined
    packageData.repository ??= entry.repository
    packageData.support ??= entry.support
    packageData.thumbnail = entry.thumbnail ?? packageData.thumbnail
    packageData.url = entry.url
  } else {
    const extraFeatures = variantEntry.features?.filter(
      feature => !packageData.features?.includes(feature),
    )

    if (extraFeatures?.length) {
      console.warn(
        `Variant ${variantId} contains features ${extraFeatures.join(",")} which are not included in the default variant. All variants must include the same feature set.`,
      )
    }

    const variantAuthors = union(authors, variantData.authors ?? []).filter(
      authorId => !packageData.authors?.includes(authorId),
    )

    const variantDependencies = union(dependencies, variantData.dependencies ?? []).filter(
      dependency => !packageData.dependencies?.includes(dependency),
    )

    const variantDescription = entry.description
      ? htmlToMd(entry.description)
      : variantData.description

    const variantImages = union(entry.images ?? [], variantData.images ?? []).filter(
      image => !packageData.images?.includes(image),
    )

    variantData.authors = variantAuthors.length ? variantAuthors.sort() : undefined
    variantData.dependencies = variantDependencies.length ? variantDependencies.sort() : undefined
    variantData.description = variantDescription
    variantData.images = variantImages.length ? variantImages : undefined
    variantData.repository ??= entry.repository
    variantData.support ??= entry.support
    variantData.thumbnail = entry.thumbnail ?? variantData.thumbnail
    variantData.url = entry.url
  }

  if (entry.category?.includes("obsolete")) {
    variantData.deprecated = true
  }

  if (variantId === "darknite") {
    variantData.name ??= "Dark Nite"
    variantData.requirements ??= {}
    variantData.requirements.darknite = true

    const defaultVariantData = packageData.variants["default" as VariantID]
    if (defaultVariantData) {
      defaultVariantData.name ??= "Maxis Nite"
      defaultVariantData.requirements ??= {}
      defaultVariantData.requirements.darknite = false
    }
  }

  let variantAsset = variantData.assets.find(variantAsset =>
    isString(variantAsset) ? variantAsset === variantAssetId : variantAsset.id === variantAssetId,
  )

  if (!variantAsset) {
    variantAsset = { id: variantAssetId }
    variantData.assets.push(variantAsset)
  } else if (isString(variantAsset)) {
    const index = variantData.assets.indexOf(variantAsset)
    variantAsset = { id: variantAssetId }
    variantData.assets.splice(index, 1, variantAsset)
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

  if (includedCleanitolFiles?.length || excludedCleanitolFiles?.length) {
    variantAsset.cleanitol = includedCleanitolFiles ?? []
  }

  if (includedDocFiles?.length || excludedDocFiles?.length) {
    variantAsset.docs = includedDocFiles ?? []
  }

  if (includedSC4Files?.length || excludedSC4Files?.length) {
    variantAsset.include = includedSC4Files ?? []
  }

  const lots = variantEntry.lots?.filter(lot => includedFiles.includes(lot.filename))

  if (lots?.length) {
    variantData.lots ??= []

    for (const lot of lots) {
      let existingLot = variantData.lots.find(({ id }) => id === lot.id)

      if (!existingLot) {
        existingLot = { id: lot.id, filename: lot.filename }
        variantData.lots.push(existingLot)
      }

      const building = variantEntry.buildings?.find(({ id }) => id === lot.building)

      existingLot.bulldoze ??= building?.bulldoze
      existingLot.capacity ??= building?.capacity
      existingLot.category ??= lot.category
      existingLot.cost ??= building?.cost
      existingLot.density ??= lot.density
      existingLot.description ??= building?.description
      existingLot.filename ??= lot.filename
      existingLot.flamability ??= building?.flamability
      existingLot.garbage ??= building?.garbage
      existingLot.garbageRadius ??= building?.garbageRadius
      existingLot.images ??= lot.images
      existingLot.income ??= building?.income
      existingLot.label ??= building?.label
      existingLot.landmark ??= building?.landmark
      existingLot.landmarkRadius ??= building?.landmarkRadius
      existingLot.maintenance ??= building?.maintenance
      existingLot.name ??= lot.name
      existingLot.pollution ??= building?.pollution
      existingLot.pollutionRadius ??= building?.pollutionRadius
      existingLot.power ??= building?.power
      existingLot.powerProduction ??= building?.powerProduction
      existingLot.radiation ??= building?.radiation
      existingLot.radiationRadius ??= building?.radiationRadius
      existingLot.rating ??= building?.rating
      existingLot.ratingRadius ??= building?.ratingRadius
      existingLot.size ??= lot.size
      existingLot.stage ??= lot.stage
      existingLot.water ??= building?.water
      existingLot.waterPollution ??= building?.waterPollution
      existingLot.waterPollutionRadius ??= building?.waterPollutionRadius
      existingLot.waterProduction ??= building?.waterProduction
      existingLot.worth ??= building?.worth
    }
  }

  return packageData
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