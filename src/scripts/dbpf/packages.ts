import path from "node:path"

import {
  difference,
  forEach,
  groupBy,
  isString,
  mapDefined,
  matchGroups,
  remove,
  union,
  unique,
} from "@salinco/nice-utils"

import type { AssetID } from "@common/assets"
import type { AuthorID } from "@common/authors"
import { CategoryID } from "@common/categories"
import { type PackageID, getOwnerId } from "@common/packages"
import { parseStringArray, toLowerCase } from "@common/utils/types"
import type { VariantID } from "@common/variants"
import type { PackageData } from "@node/data/packages"
import { type FileData, loadCredits } from "@node/data/variants"
import { getExtension } from "@node/files"

import { loadAuthors } from "@node/data/authors"
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
  packageFiles: { [path in string]?: FileData },
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
  const ownerId = getOwnerId(packageId)

  const [major, minor, patch] = matchGroups(entry.version, /(\d+)(?:[.](\d+)(?:[.](\d+))?)?/)

  const categories = new Set(parseStringArray(packageData.category ?? []))

  if (variantEntry.categories && variantId === "default") {
    for (const category of variantEntry.categories) {
      categories.add(category)
    }
  }

  if (source && entry.category) {
    const defaultCategories = source.categories[entry.category]?.categories
    if (defaultCategories) {
      for (const category of defaultCategories) {
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

  const newVersion = `${major}.${minor ?? 0}.${patch ?? 0}`

  variantData.assets ??= []
  variantData.lastGenerated = timestamp
  variantData.lastModified = entry.lastModified
  variantData.logs ??= entry.description?.match(/\b[\w-]+[.]log\b/)?.at(0)

  if (variantData.version !== newVersion) {
    variantData.release = timestamp
    variantData.version = `${major}.${minor ?? 0}.${patch ?? 0}`
  }

  if (variantId === "default" || !packageData.url || packageData.url === entry.url) {
    const packageAuthors = unique(
      remove(
        loadAuthors(packageData.authors ?? [], ownerId).concat(authors) as AuthorID[],
        ownerId,
      ),
    )

    const packageCredits = {
      ...packageData.credits,
      ...difference(
        authors,
        mapDefined(
          [packageData.credits ?? [], packageData.thanks ?? []].flatMap(loadCredits),
          credit => credit.id,
        ),
      ),
    }

    const packageDependencies = union(dependencies, packageData.dependencies ?? [])

    const packageDescription = entry.description
      ? htmlToMd(entry.description)
      : packageData.description

    const packageFeatures = union(
      variantEntry.features ?? [],
      parseStringArray(packageData.features ?? []).map(toLowerCase),
    )

    const packageImages = union(entry.images ?? [], packageData.images ?? [])

    packageData.authors = packageAuthors.length ? packageAuthors : undefined
    packageData.credits = packageCredits.length ? packageCredits : undefined
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

    const variantAuthors = difference(
      unique(loadAuthors(variantData.authors ?? [], ownerId).concat(authors)),
      loadAuthors(packageData.authors ?? [], ownerId),
    )

    const variantCredits = {
      ...packageData.credits,
      ...difference(
        authors,
        mapDefined(
          [
            packageData.credits ?? [],
            packageData.thanks ?? [],
            variantData.credits ?? [],
            variantData.thanks ?? [],
          ].flatMap(loadCredits),
          credit => credit.id,
        ),
      ),
    }

    const variantDependencies = union(dependencies, variantData.dependencies ?? []).filter(
      dependency => !packageData.dependencies?.includes(dependency),
    )

    const variantDescription = entry.description
      ? htmlToMd(entry.description)
      : variantData.description

    const variantImages = union(entry.images ?? [], variantData.images ?? []).filter(
      image => !packageData.images?.includes(image),
    )

    variantData.authors = variantAuthors.length ? variantAuthors : undefined
    variantData.credits = variantCredits.length ? variantCredits : undefined
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

  if (includedCleanitolFiles?.length) {
    variantAsset.cleanitol = includedCleanitolFiles
  } else if (excludedCleanitolFiles?.length) {
    variantAsset.cleanitol = []
  }

  if (includedDocFiles?.length) {
    variantAsset.docs = includedDocFiles
  } else if (excludedDocFiles?.length) {
    variantAsset.docs = []
  }

  if (includedSC4Files?.length) {
    variantAsset.include = includedSC4Files.map(file => packageFiles[file] ?? file)
  } else if (excludedSC4Files?.length) {
    variantAsset.include = []
  }

  if (variantEntry.buildingFamilies) {
    forEach(variantEntry.buildingFamilies, (families, file) => {
      if (includedFiles.includes(file)) {
        forEach(families, (data, id) => {
          variantData.buildingFamilies ??= {}
          variantData.buildingFamilies[file] ??= {}
          variantData.buildingFamilies[file][id] = {
            ...data,
            ...variantData.buildingFamilies[file][id],
          }
        })
      }
    })
  }

  if (variantEntry.buildings) {
    forEach(variantEntry.buildings, (buildings, file) => {
      if (includedFiles.includes(file)) {
        forEach(buildings, ({ model, ...data }, id) => {
          variantData.buildings ??= {}
          variantData.buildings[file] ??= {}
          variantData.buildings[file][id] = {
            ...data,
            ...variantData.buildings[file][id],
          }
        })
      }
    })
  }

  if (variantEntry.lots) {
    forEach(variantEntry.lots, (lots, file) => {
      if (includedFiles.includes(file)) {
        forEach(lots, ({ props, textures, ...data }, id) => {
          variantData.lots ??= {}
          variantData.lots[file] ??= {}
          variantData.lots[file][id] = {
            ...data,
            ...variantData.lots[file][id],
          }
        })
      }
    })
  }

  if (variantEntry.mmps) {
    forEach(variantEntry.mmps, (mmps, file) => {
      if (includedFiles.includes(file)) {
        forEach(mmps, ({ model, stages, ...data }, id) => {
          variantData.mmps ??= {}
          variantData.mmps[file] ??= {}
          variantData.mmps[file][id] = {
            stages: stages?.map(({ model, ...stage }) => stage),
            ...data,
            ...variantData.mmps[file][id],
          }
        })
      }
    })
  }

  if (variantEntry.propFamilies) {
    forEach(variantEntry.propFamilies, (families, file) => {
      if (includedFiles.includes(file)) {
        forEach(families, (data, id) => {
          variantData.propFamilies ??= {}
          variantData.propFamilies[file] ??= {}
          variantData.propFamilies[file][id] = {
            ...data,
            ...variantData.propFamilies[file][id],
          }
        })
      }
    })
  }

  if (variantEntry.props) {
    forEach(variantEntry.props, (props, file) => {
      if (includedFiles.includes(file)) {
        forEach(props, ({ model, ...data }, id) => {
          variantData.props ??= {}
          variantData.props[file] ??= {}
          variantData.props[file][id] = {
            ...data,
            ...variantData.props[file][id],
          }
        })
      }
    })
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
