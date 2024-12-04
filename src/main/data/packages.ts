import fs from "node:fs/promises"
import path from "node:path"

import {
  collect,
  filterValues,
  forEach,
  isEmpty,
  keys,
  mapValues,
  size,
  values,
} from "@salinco/nice-utils"
import { glob } from "glob"

import type { AssetID, Assets } from "@common/assets"
import type { Categories } from "@common/categories"
import type { PackageID } from "@common/packages"
import { ConfigFormat, type Feature, type PackageInfo, type Packages } from "@common/types"
import { parseStringArray, toLowerCase } from "@common/utils/types"
import type { VariantID } from "@common/variants"
import { readConfig } from "@node/configs"
import type { AssetData } from "@node/data/assets"
import type { PackageData } from "@node/data/packages"
import { loadVariantInfo } from "@node/data/variants"
import { createIfMissing, exists } from "@node/files"
import { DIRNAMES, FILENAMES } from "@utils/constants"
import type { TaskContext } from "@utils/tasks"

import { writeBuildingInfo } from "@node/data/buildings"
import { writeFamilyInfo } from "@node/data/families"
import { writeLotInfo } from "@node/data/lots"
import { writePropInfo } from "@node/data/props"
import { loadAssetInfo } from "./assets"

/**
 * Loads all downloaded assets.
 */
export async function loadDownloadedAssets(
  context: TaskContext,
  basePath: string,
): Promise<{ [assetId in AssetID]?: string[] }> {
  const assets: { [assetId in AssetID]?: string[] } = {}

  const downloadKeys = await glob("*/*@*/", { cwd: basePath, posix: true })

  for (const downloadKey of downloadKeys) {
    const [assetId, version] = downloadKey.split("@") as [AssetID, string]
    assets[assetId] ??= []
    assets[assetId].push(version)
  }

  context.info(`Loaded ${size(assets)} local assets`)

  return assets
}

/**
 * Loads all local packages.
 */
export async function loadLocalPackages(
  context: TaskContext,
  packagesPath: string,
  categories: Categories,
): Promise<Packages> {
  await createIfMissing(packagesPath)

  const packages: Packages = {}

  const packageIds = await glob("*/*/", { cwd: packagesPath, posix: true })

  let nConfigs = 0
  for (const packageId of packageIds as PackageID[]) {
    context.setProgress(nConfigs++, packageIds.length)
    const packagePath = path.join(packagesPath, packageId)
    const packageInfo = await loadLocalPackageInfo(packageId, packagePath, categories)
    if (packageInfo) {
      packages[packageId] = packageInfo
    }
  }

  context.info(`Loaded ${size(packages)} local packages`)

  return packages
}

/**
 * Loads a local package from its local installation folder.
 */
async function loadLocalPackageInfo(
  packageId: PackageID,
  packagePath: string,
  categories: Categories,
): Promise<PackageInfo | undefined> {
  const entries = await fs.readdir(packagePath, { withFileTypes: true })

  const configNames = collect(ConfigFormat, format => FILENAMES.packageConfig + format)
  const configEntry = entries.find(entry => entry.isFile() && configNames.includes(entry.name))

  let configFormat: ConfigFormat | undefined
  let packageData: PackageData = {}

  if (configEntry) {
    const configPath = path.join(packagePath, configEntry.name)
    // TODO: This assumes that configs are correctly formatted
    packageData = await readConfig<PackageData>(configPath)
    configFormat = path.extname(configEntry.name) as ConfigFormat
  }

  const packageInfo: PackageInfo = {
    format: configFormat,
    id: packageId,
    name: packageData.name ?? packageId,
    status: {},
    variants: {},
  }

  if (packageData.features?.length) {
    packageInfo.features = parseStringArray(packageData.features).map(toLowerCase) as Feature[] // todo
  }

  for (const entry of entries) {
    // ~ is reserved for special folders, e.g. ~docs
    if (entry.isDirectory() && !entry.name.startsWith("~")) {
      const variantId = entry.name as VariantID
      const variantInfo = loadVariantInfo(packageId, variantId, packageData, categories)
      packageInfo.variants[variantId] = variantInfo
      variantInfo.installed = true

      const docsPath = DIRNAMES.docs
      if (await exists(path.join(packagePath, entry.name, docsPath))) {
        variantInfo.docs = docsPath
      }
    }
  }

  // Return the package only if some variants have been successfully loaded
  if (!isEmpty(packageInfo.variants)) {
    return packageInfo
  }
}

/**
 * Loads all remote packages.
 */
export async function loadRemotePackages(
  context: TaskContext,
  basePath: string,
  categories: Categories,
  localPackages: Packages,
  downloadedAssets: { [assetId in AssetID]?: string[] },
): Promise<{ assets: Assets; packages: Packages }> {
  const assets: Assets = {}
  const packages: Packages = {}

  let nAssets = 0
  let nConfigs = 0
  let nPackages = 0

  const assetsPath = path.join(basePath, DIRNAMES.dbAssets)
  const assetsEntries = await glob("**/*.{yaml,yml}", { cwd: assetsPath })
  const packagesPath = path.join(basePath, DIRNAMES.dbPackages)
  const packagesEntries = await glob("**/*.{yaml,yml}", { cwd: packagesPath })

  for (const assetsEntry of assetsEntries) {
    context.setProgress(nConfigs++, assetsEntries.length + packagesEntries.length)
    const configPath = path.join(assetsPath, assetsEntry)

    // TODO: This assumes that configs are correctly formatted
    const configs = await readConfig<{ [assetId: AssetID]: AssetData }>(configPath)
    for (const assetId of keys(configs)) {
      const assetInfo = loadAssetInfo(assetId, configs[assetId], downloadedAssets[assetId])
      if (assetInfo) {
        assets[assetId] = assetInfo
        nAssets++
      }
    }
  }

  for (const packagesEntry of packagesEntries) {
    context.setProgress(nConfigs++, assetsEntries.length + packagesEntries.length)
    const configPath = path.join(packagesPath, packagesEntry)

    // TODO: This assumes that configs are correctly formatted
    const configs = await readConfig<{ [packageId: PackageID]: PackageData }>(configPath)
    for (const packageId of keys(configs)) {
      // Skip disabled packages
      if (configs[packageId].disabled) {
        continue
      }

      const packageInfo = loadRemotePackageInfo(packageId, configs[packageId], categories)
      if (packageInfo) {
        packages[packageId] = packageInfo
        nPackages++

        // Check assets
        for (const variantInfo of values(packageInfo.variants)) {
          if (variantInfo.assets) {
            for (const asset of variantInfo.assets) {
              if (!assets[asset.id]) {
                context.raiseInDev(`Asset ${asset.id} does not exist`)
              }
            }
          }
        }
      }
    }
  }

  // Merge local and remote package definitions...
  forEach(localPackages, (localPackageInfo, packageId) => {
    packages[packageId] = mergeLocalPackageInfo(localPackageInfo, packages[packageId])
  })

  context.info(`Loaded ${nAssets} remote assets`)
  context.info(`Loaded ${nPackages} remote packages`)

  return { assets, packages }
}

/**
 * Loads a remote package configuration.
 */
function loadRemotePackageInfo(
  packageId: PackageID,
  packageData: PackageData,
  categories: Categories,
): PackageInfo | undefined {
  const packageInfo: PackageInfo = {
    id: packageId,
    name: packageData.name ?? packageId,
    status: {},
    variants: {},
  }

  if (packageData.features?.length) {
    packageInfo.features = parseStringArray(packageData.features).map(toLowerCase) as Feature[] // todo
  }

  if (packageData.variants) {
    for (const variantId of keys(packageData.variants)) {
      // Skip disabled variants
      if (!packageData.variants[variantId]?.disabled) {
        const variantInfo = loadVariantInfo(packageId, variantId, packageData, categories)
        packageInfo.variants[variantId] = variantInfo
      }
    }
  }

  // Return the package only if some variants have been successfully loaded
  if (!isEmpty(packageInfo.variants)) {
    return packageInfo
  }
}

/**
 * Merges a local package definition with a remote one.
 */
function mergeLocalPackageInfo(
  localPackageInfo: PackageInfo,
  remotePackageInfo: PackageInfo | undefined,
): PackageInfo {
  if (remotePackageInfo) {
    // TODO: Improve this function
    localPackageInfo.features = remotePackageInfo.features

    forEach(localPackageInfo.variants, (localVariantInfo, variantId) => {
      const remoteVariantInfo = remotePackageInfo.variants[variantId]
      if (remoteVariantInfo) {
        // If remote and local have same version, prefer data from remote (this allows
        // pushing updates to a package without forcing users to reinstall, although
        // this should only be used for minor changes). If versions are different, store
        // the remote version separately, as a potential update instead.
        if (remoteVariantInfo.version === localVariantInfo.version) {
          // Keep local installation paths calculated during install
          remoteVariantInfo.buildingFamilies = localVariantInfo.buildingFamilies
          remoteVariantInfo.buildings = localVariantInfo.buildings
          remoteVariantInfo.files = localVariantInfo.files
          remoteVariantInfo.lots = localVariantInfo.lots
          remoteVariantInfo.propFamilies = localVariantInfo.propFamilies
          remoteVariantInfo.props = localVariantInfo.props
          remoteVariantInfo.readme ??= localVariantInfo.readme
          Object.assign(localVariantInfo, remoteVariantInfo)
          localVariantInfo.installed = true
        } else {
          localVariantInfo.update = remoteVariantInfo
        }
      } else {
        localVariantInfo.local = true
      }
    })

    forEach(remotePackageInfo.variants, (remoteVariantInfo, variantId) => {
      localPackageInfo.variants[variantId] ??= remoteVariantInfo
    })
  } else {
    localPackageInfo.local = true

    forEach(localPackageInfo.variants, localVariantInfo => {
      localVariantInfo.local = true
    })
  }

  return localPackageInfo
}

export function toPackageData(packageInfo: PackageInfo): PackageData {
  return {
    features: packageInfo.features?.length ? packageInfo.features : undefined,
    name: packageInfo.name,
    variants: mapValues(
      filterValues(packageInfo.variants, variant => !!variant.installed),
      variant => ({
        authors: variant.authors,
        buildingFamilies: variant.buildingFamilies
          ? mapValues(variant.buildingFamilies, families => mapValues(families, writeFamilyInfo))
          : undefined,
        buildings: variant.buildings
          ? mapValues(variant.buildings, buildings => mapValues(buildings, writeBuildingInfo))
          : undefined,
        category: variant.categories.join(","),
        credits: variant.credits,
        dependencies: variant.dependencies?.length ? variant.dependencies : undefined,
        deprecated: variant.deprecated,
        description: variant.description,
        experimental: variant.experimental,
        files: variant.files,
        images: variant.images,
        lastModified: variant.lastModified ? new Date(variant.lastModified) : undefined,
        logs: variant.logs,
        lots: variant.lots
          ? mapValues(variant.lots, lots => mapValues(lots, writeLotInfo))
          : undefined,
        mmps: variant.mmps?.map(({ categories, ...mmp }) => ({
          category: categories?.join(","),
          ...mmp,
        })),
        name: variant.name,
        optional: variant.optional,
        options: variant.options,
        propFamilies: variant.propFamilies
          ? mapValues(variant.propFamilies, families => mapValues(families, writeFamilyInfo))
          : undefined,
        props: variant.props
          ? mapValues(variant.props, props => mapValues(props, writePropInfo))
          : undefined,
        readme: variant.readme,
        release: variant.release ? new Date(variant.release) : undefined,
        repository: variant.repository,
        requirements: variant.requirements,
        summary: variant.summary,
        support: variant.support,
        thanks: variant.thanks,
        thumbnail: variant.thumbnail,
        url: variant.url,
        version: variant.version,
        warnings: variant.warnings,
      }),
    ),
  }
}
