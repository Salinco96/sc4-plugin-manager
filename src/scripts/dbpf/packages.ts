import { AssetID } from "@common/assets"
import { AuthorID } from "@common/authors"
import { PackageID } from "@common/packages"
import { PackageData } from "@common/types"
import { splitBy, union } from "@common/utils/arrays"
import { isString } from "@common/utils/types"
import { VariantID } from "@common/variants"
import { getExtension } from "@node/files"

import { IndexerEntry, IndexerSource } from "../types"
import { htmlToMd } from "../utils"

export function extractDependencies(html: string): string[] {
  const dependencies = new Set<string>()

  // Simtropolis file page URL
  for (const match of html.matchAll(
    /(https:[/][/]community.simtropolis.com)?[/]files[/]file[/]([\w-]+)[/]?/g,
  )) {
    dependencies.add(`simtropolis/${match[2]}`)
  }

  // SC4Evermore file page URL
  for (const match of html.matchAll(
    /(https:[/][/]www.sc4evermore.com)?[/]index.php[/]downloads[/]download[/][\w-]+[/]([\w-]+)[/]?/g,
  )) {
    dependencies.add(`sc4evermore/${match[2]}`)
  }

  return Array.from(dependencies)
}

export function extractRepository(html: string): string | undefined {
  // We hardcode a few known GitHub users not to pick up random repositories
  const match = html.match(/https:\/\/github.com\/(0xC0000054|memo33|nsgomez)\/([\w-]+)?/g)
  return match?.[0]
}

export function writePackageData(
  packageData: PackageData = {},
  assetId: AssetID,
  source: IndexerSource | undefined,
  entry: IndexerEntry,
  variant: string | undefined,
  variantId: VariantID,
  authors: AuthorID[],
  dependencies: PackageID[],
  timestamp: Date,
): PackageData {
  const variantAssetId = variant ? (`${assetId}#${variant}` as AssetID) : assetId
  const variantEntry = variant ? entry.variants?.[variant] : entry
  if (!variantEntry?.files || !entry.version) {
    throw Error(`Expected override to exist for ${variantAssetId}`)
  }

  packageData.variants ??= {}
  packageData.variants[variantId] ??= {}
  const variantData = packageData.variants[variantId]

  const [, major, minor, patch] = entry.version.match(/(\d+)(?:[.](\d+)(?:[.](\d+))?)?/)!

  packageData.category ??=
    source && entry.category ? source.categories[entry.category].category : "mods"

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

  const sc4Extensions = [".dat", ".dll", ".ini", "._loosedesc", ".sc4desc", ".sc4lot", ".sc4model"]

  const [sc4Files, docFiles] = splitBy(variantEntry.files, file =>
    sc4Extensions.includes(getExtension(file)),
  )

  if (docFiles.length) {
    variantAsset.docs = docFiles
  }

  if (sc4Files.length) {
    variantAsset.include = sc4Files
  }

  if (variantEntry.lots?.length) {
    variantData.lots ??= []

    for (const lot of variantEntry.lots) {
      let existingLot = variantData.lots.find(({ id }) => id === lot.id)

      if (!existingLot) {
        existingLot = { id: lot.id }
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
