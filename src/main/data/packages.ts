import fs from "fs/promises"
import path from "path"

import { glob } from "glob"

import { AssetData, AssetID, AssetInfo } from "@common/assets"
import { AuthorID } from "@common/authors"
import { Categories, CategoryID, CategoryInfo } from "@common/categories"
import { OptionType } from "@common/options"
import { LOTS_OPTION_ID, MMPS_OPTION_ID, PackageID, isNew } from "@common/packages"
import { ConfigFormat, PackageData, PackageInfo } from "@common/types"
import { mapDefined, potentialUnion, potentialUnionBy, unionBy } from "@common/utils/arrays"
import { entries, forEach, keys, values } from "@common/utils/objects"
import { isString } from "@common/utils/types"
import {
  DependencyData,
  DependencyInfo,
  VariantAssetData,
  VariantAssetInfo,
  VariantData,
  VariantID,
  VariantInfo,
} from "@common/variants"
import { readConfig, writeConfig } from "@node/configs"
import { exists } from "@node/files"
import { DIRNAMES, FILENAMES } from "@utils/constants"
import { isDev } from "@utils/env"

import { loadAssetInfo } from "./assets"
import { loadOptionInfo } from "./options"

/**
 * Loads all downloaded assets.
 */
export async function loadDownloadedAssets(
  basePath: string,
): Promise<{ [assetId in AssetID]?: string[] }> {
  console.info("Loading local assets...")

  const assets: { [assetId in AssetID]?: string[] } = {}

  const downloadKeys = await glob("*/*@*/", { cwd: basePath, posix: true })

  for (const downloadKey of downloadKeys) {
    const [assetId, version] = downloadKey.split("@") as [AssetID, string]
    assets[assetId] ??= []
    assets[assetId].push(version)
  }

  console.info(`Loaded ${keys(assets).length} local assets`)

  return assets
}

/**
 * Loads all local packages.
 */
export async function loadLocalPackages(
  basePath: string,
  categories: Categories,
  onProgress: (current: number, total: number) => void,
): Promise<{ [packageId: PackageID]: PackageInfo }> {
  console.info("Loading local packages...")

  const packages: { [packageId: PackageID]: PackageInfo } = {}

  const packageIds = await glob("*/*/", { cwd: basePath, posix: true })

  let nConfigs = 0
  let nPackages = 0
  for (const packageId of packageIds as PackageID[]) {
    onProgress(nConfigs++, packageIds.length)
    const packagePath = path.join(basePath, packageId)
    const packageInfo = await loadLocalPackageInfo(packageId, packagePath, categories)
    if (packageInfo) {
      packages[packageId] = packageInfo
      nPackages++
    }
  }

  console.info(`Loaded ${nPackages} local packages`)

  return packages
}

/**
 * Loads a local package from its local installation folder.
 */
export async function loadLocalPackageInfo(
  packageId: PackageID,
  packagePath: string,
  categories: Categories,
): Promise<PackageInfo | undefined> {
  const entries = await fs.readdir(packagePath, { withFileTypes: true })

  const configNames = Object.values(ConfigFormat).map(format => FILENAMES.packageConfig + format)
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
    features: packageData.features,
    format: configFormat,
    id: packageId,
    local: true,
    name: packageData.name ?? packageId,
    status: {},
    variants: {},
  }

  for (const entry of entries) {
    // ~ is reserved for special folders, e.g. ~docs
    if (entry.isDirectory() && !entry.name.startsWith("~")) {
      const variantId = entry.name as VariantID
      const variantInfo = loadVariantInfo(variantId, packageData, categories)
      packageInfo.variants[variantId] = variantInfo
      variantInfo.installed = true
      variantInfo.local = true

      if (await exists(path.join(packagePath, variantId, DIRNAMES.cleanitol))) {
        variantInfo.cleanitol = DIRNAMES.cleanitol
      }

      if (await exists(path.join(packagePath, variantId, DIRNAMES.docs))) {
        variantInfo.docs = DIRNAMES.docs
      }

      if (!variantInfo.authors.length) {
        const author = packageId.split("/")[0] as AuthorID
        variantInfo.authors.push(author)
      }
    }
  }

  // Return the package only if some variants have been successfully loaded
  if (Object.keys(packageInfo.variants).length) {
    return packageInfo
  }
}

/**
 * Loads all remote packages.
 */
export async function loadRemotePackages(
  basePath: string,
  categories: Categories,
  downloadedAssets: { [assetId in AssetID]?: string[] },
  onProgress: (current: number, total: number) => void,
): Promise<{
  assets: { [assetId in AssetID]?: AssetInfo }
  packages: { [packageId in PackageID]?: PackageInfo }
}> {
  console.info("Loading remote packages...")

  const assets: { [assetId in AssetID]?: AssetInfo } = {}
  const packages: { [packageId in PackageID]?: PackageInfo } = {}

  let nAssets = 0
  let nConfigs = 0
  let nPackages = 0

  const assetsPath = path.join(basePath, DIRNAMES.dbAssets)
  const assetsEntries = await glob("**/*.{yaml,yml}", { cwd: assetsPath })
  const packagesPath = path.join(basePath, DIRNAMES.dbPackages)
  const packagesEntries = await glob("**/*.{yaml,yml}", { cwd: packagesPath })

  for (const assetsEntry of assetsEntries) {
    onProgress(nConfigs++, assetsEntries.length + packagesEntries.length)
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
    onProgress(nConfigs++, assetsEntries.length + packagesEntries.length)
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

        // Check assets and add inlined ones
        for (const variantInfo of values(packageInfo.variants)) {
          if (variantInfo.assets) {
            for (const asset of variantInfo.assets) {
              // Inline asset definition should have at least one of these
              if (asset.sha256 || asset.size || asset.url || asset.version) {
                if (assets[asset.id]) {
                  // Do not allow redefining an existing asset
                  if (isDev()) {
                    throw Error(`Redefining asset ID ${asset.id}`)
                  } else {
                    console.warn(`Redefining asset ID ${asset.id}`)
                  }
                } else {
                  // Load inline asset
                  const assetInfo = loadAssetInfo(asset.id, asset, downloadedAssets[asset.id])
                  if (assetInfo) {
                    assets[asset.id] = assetInfo
                    nAssets++
                  }
                }
              } else if (!assets[asset.id]) {
                // Otherwise require asset to already exist
                if (isDev()) {
                  throw Error(`Asset ${asset.id} does not exist`)
                } else {
                  console.warn(`Asset ${asset.id} does not exist`)
                }
              }
            }
          }
        }
      }
    }
  }

  console.info(`Loaded ${nAssets} assets`)
  console.info(`Loaded ${nPackages} remote packages`)

  return { assets, packages }
}

/**
 * Loads a remote package configuration.
 */
export function loadRemotePackageInfo(
  packageId: PackageID,
  packageData: PackageData,
  categories: Categories,
): PackageInfo | undefined {
  const packageInfo: PackageInfo = {
    features: packageData.features,
    id: packageId,
    name: packageData.name ?? packageId,
    status: {},
    variants: {},
  }

  if (packageData.variants) {
    for (const variantId of keys(packageData.variants)) {
      const variantInfo = loadVariantInfo(variantId, packageData, categories)
      packageInfo.variants[variantId] = variantInfo
      if (!variantInfo.authors.length) {
        const author = packageId.split("/")[0] as AuthorID
        variantInfo.authors.push(author)
      }
    }
  }

  // Return the package only if some variants have been successfully loaded
  if (Object.keys(packageInfo.variants).length) {
    return packageInfo
  }
}

export function parseCategory(category: string, categories: Categories): CategoryID[] {
  const subcategories = category.split(/\s*,\s*/) as CategoryID[]

  let subcategory: CategoryID | undefined
  for (subcategory of subcategories) {
    while (subcategory) {
      const info: CategoryInfo | undefined = categories[subcategory]

      if (!subcategories.includes(subcategory)) {
        subcategories.unshift(subcategory)
      }

      subcategory = info?.parent
    }
  }

  return subcategories
}

export function loadPackageAssetInfo(data: VariantAssetData | AssetID): VariantAssetInfo {
  if (isString(data)) {
    return { id: data }
  }

  return {
    ...data,
    docs: data.docs?.map(file => {
      if (isString(file)) {
        return { path: file }
      }

      return file
    }),
    include: data.include?.map(file => {
      if (isString(file)) {
        return { path: file }
      }

      return file
    }),
  }
}

export function loadDependencyInfo(data: DependencyData | PackageID): DependencyInfo {
  if (isString(data)) {
    return { id: data, transitive: true }
  }

  return {
    transitive: !data.include,
    ...data,
  }
}

/**
 * Loads a variant from a package configuration.
 */
export function loadVariantInfo(
  variantId: VariantID,
  packageData: PackageData,
  categories: Categories,
): VariantInfo {
  const variantData = packageData.variants?.[variantId] ?? {}

  const category = variantData.category ?? packageData.category ?? "mods"
  const subcategories = parseCategory(category, categories)
  const priorities = subcategories.map(categoryId => categories[categoryId]?.priority ?? 0)
  const priority = Math.max(...priorities)

  const variantInfo: VariantInfo = {
    assets: potentialUnionBy(
      variantData.assets?.map(loadPackageAssetInfo),
      packageData.assets?.map(loadPackageAssetInfo),
      asset => asset.id,
    ),
    authors: potentialUnion(variantData.authors, packageData.authors) ?? [],
    categories: subcategories,
    dependencies: potentialUnionBy(
      variantData.dependencies?.map(loadDependencyInfo),
      packageData.dependencies?.map(loadDependencyInfo),
      dependency => dependency.id,
    ),
    deprecated: variantData.deprecated ?? packageData.deprecated,
    description: variantData.description ?? packageData.description,
    experimental: variantData.experimental ?? packageData.experimental,
    files: potentialUnionBy(variantData.files, packageData.files, file => file.path),
    id: variantId,
    images: variantData.images ?? packageData.images,
    logs: variantData.logs ?? packageData.logs,
    lots: potentialUnionBy(variantData.lots, packageData.lots, lot => lot.id)?.map(lot =>
      lot.category
        ? {
            categories: parseCategory(lot.category, categories),
            ...lot,
          }
        : lot,
    ),
    mmps: potentialUnionBy(variantData.mmps, packageData.mmps, mmp => mmp.id)?.map(mmp =>
      mmp.category
        ? {
            categories: parseCategory("mmps," + mmp.category, categories),
            ...mmp,
          }
        : mmp,
    ),
    name: variantData.name ?? variantId,
    optional: potentialUnion(variantData.optional, packageData.optional),
    options: mapDefined(
      unionBy(variantData.options ?? [], packageData.options ?? [], option => option.id),
      loadOptionInfo,
    ),
    priority,
    readme: variantData.readme ?? packageData.readme,
    release: variantData.release ?? packageData.release,
    repository: variantData.repository ?? packageData.repository,
    requirements: { ...packageData.requirements, ...variantData.requirements },
    thumbnail: variantData.thumbnail ?? packageData.thumbnail,
    url: variantData.url ?? packageData.url,
    version: variantData.version ?? packageData.version ?? "0.0.0",
    warnings: potentialUnion(variantData.warnings, packageData.warnings),
  }

  if (isNew(variantInfo)) {
    variantInfo.new = true
  }

  if (variantInfo.lots && !variantInfo.options?.some(option => option.id === LOTS_OPTION_ID)) {
    variantInfo.options ??= []

    variantInfo.options.unshift({
      choices: variantInfo.lots.map(lot => ({
        condition: lot.requirements,
        description: lot.description,
        label: lot.label,
        value: lot.id,
      })),
      default: variantInfo.lots.filter(lot => lot.default !== false).map(lot => lot.id),
      display: "checkbox",
      id: LOTS_OPTION_ID,
      multi: true,
      section: "Lots", // TODO: i18n?
      type: OptionType.STRING,
    })
  }

  if (variantInfo.mmps && !variantInfo.options?.some(option => option.id === MMPS_OPTION_ID)) {
    variantInfo.options ??= []

    variantInfo.options.unshift({
      choices: variantInfo.mmps.map(mmp => ({
        condition: mmp.requirements,
        description: mmp.description,
        label: mmp.label,
        value: mmp.id,
      })),
      default: variantInfo.mmps.filter(mmp => mmp.default !== false).map(mmp => mmp.id),
      display: "checkbox",
      id: MMPS_OPTION_ID,
      multi: true,
      section: "MMPs", // TODO: i18n?
      type: OptionType.STRING,
    })
  }

  return variantInfo
}

/**
 * Merges a local package definition with a remote one.
 */
export function mergeLocalPackageInfo(
  localPackageInfo: PackageInfo,
  remotePackageInfo: PackageInfo,
): PackageInfo {
  delete localPackageInfo.local

  // TODO: Improve this function
  localPackageInfo.features = remotePackageInfo.features

  forEach(localPackageInfo.variants, (localVariantInfo, variantId) => {
    const remoteVariantInfo = remotePackageInfo.variants[variantId]
    if (remoteVariantInfo) {
      delete localVariantInfo.local

      // If remote and local have same version, prefer data from remote (this allows
      // pushing updates to a package without forcing users to reinstall, although
      // this should only be used for minor changes). If versions are different, store
      // the remote version separately, as a potential update instead.
      if (remoteVariantInfo.version === localVariantInfo.version) {
        // Keep local installation paths calculated during install
        remoteVariantInfo.readme ??= localVariantInfo.readme
        remoteVariantInfo.files ??= localVariantInfo.files
        Object.assign(localVariantInfo, remoteVariantInfo)
        localVariantInfo.installed = true
      } else {
        localVariantInfo.update = remoteVariantInfo
      }
    }
  })

  forEach(remotePackageInfo.variants, (remoteVariantInfo, variantId) => {
    localPackageInfo.variants[variantId] ??= remoteVariantInfo
  })

  return localPackageInfo
}

/**
 * Writes the current package definition into a configuration file.
 */
export async function writePackageConfig(
  packagePath: string,
  packageInfo: PackageInfo,
  newFormat: ConfigFormat,
): Promise<void> {
  await writeConfig<PackageData>(
    packagePath,
    FILENAMES.packageConfig,
    {
      features: packageInfo.features,
      name: packageInfo.name,
      variants: Object.fromEntries(
        entries(packageInfo.variants)
          .filter(([_, variant]) => !!variant.installed)
          .map<[VariantID, VariantData]>(([id, variant]) => [
            id,
            {
              authors: variant.authors,
              category: variant.categories.join(","),
              dependencies: variant.dependencies?.length ? variant.dependencies : undefined,
              deprecated: variant.deprecated,
              description: variant.description,
              experimental: variant.experimental,
              files: variant.files,
              images: variant.images,
              lastModified: variant.lastModified,
              logs: variant.logs,
              lots: variant.lots?.map(({ categories, ...lot }) => ({
                category: categories?.join(","),
                ...lot,
              })),
              mmps: variant.mmps?.map(({ categories, ...mmp }) => ({
                category: categories?.join(","),
                ...mmp,
              })),
              name: variant.name,
              optional: variant.optional,
              options: variant.options,
              readme: variant.readme,
              repository: variant.repository,
              requirements: variant.requirements,
              thumbnail: variant.thumbnail,
              url: variant.url,
              version: variant.version,
              warnings: variant.warnings,
            },
          ]),
      ),
    },
    newFormat,
    packageInfo.format,
  )

  packageInfo.format = newFormat
}
