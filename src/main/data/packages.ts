import fs from "fs/promises"
import path from "path"

import { glob } from "glob"

import { defaultCategory } from "@common/categories"
import {
  AssetInfo,
  ConfigFormat,
  PackageData,
  PackageInfo,
  VariantData,
  VariantInfo,
} from "@common/types"
import { readConfig, writeConfig } from "@node/configs"
import { exists } from "@node/files"
import { DIRNAMES, FILENAMES } from "@utils/constants"
import { isDev } from "@utils/env"

import { loadAssetInfo } from "./assets"

/**
 * Loads all local packages.
 */
export async function loadLocalPackages(
  basePath: string,
  onProgress: (current: number, total: number) => void,
): Promise<{ [packageId: string]: PackageInfo }> {
  console.info("Loading local packages...")

  const packages: { [packageId: string]: PackageInfo } = {}

  const packageIds = await glob("*/*/", { cwd: basePath, posix: true })

  let nConfigs = 0
  let nPackages = 0
  for (const packageId of packageIds) {
    onProgress(nConfigs++, packageIds.length)
    const packagePath = path.join(basePath, packageId)
    const packageInfo = await loadLocalPackageInfo(packageId, packagePath)
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
  packageId: string,
  packagePath: string,
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
      const variantId = entry.name
      const variantInfo = loadVariantInfo(variantId, packageData)
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
        variantInfo.authors.push(packageId.split("/")[0])
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
  onProgress: (current: number, total: number) => void,
): Promise<{
  assets: { [assetId: string]: AssetInfo }
  packages: { [packageId: string]: PackageInfo }
}> {
  console.info("Loading remote packages...")

  const assets: { [assetId: string]: AssetInfo } = {}
  const packages: { [packageId: string]: PackageInfo } = {}

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
    const configs = await readConfig<{ [assetId: string]: PackageData }>(configPath)
    for (const assetId in configs) {
      const assetInfo = loadAssetInfo(assetId, configs[assetId])
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
    const configs = await readConfig<{ [packageId: string]: PackageData }>(configPath)
    for (const packageId in configs) {
      // Skip disabled packages
      if (configs[packageId].disabled) {
        continue
      }

      const packageInfo = loadRemotePackageInfo(packageId, configs[packageId])
      if (packageInfo) {
        packages[packageId] = packageInfo
        nPackages++

        // Check assets and add inlined ones
        for (const variantId in packageInfo.variants) {
          const variantInfo = packageInfo.variants[variantId]
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
                  const assetInfo = loadAssetInfo(asset.id, asset)
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
  packageId: string,
  packageData: PackageData,
): PackageInfo | undefined {
  const packageInfo: PackageInfo = {
    id: packageId,
    name: packageData.name ?? packageId,
    status: {},
    variants: {},
  }

  for (const variantId in packageData.variants) {
    const variantInfo = loadVariantInfo(variantId, packageData)
    packageInfo.variants[variantId] = variantInfo
    if (!variantInfo.authors.length) {
      variantInfo.authors.push(packageId.split("/")[0])
    }
  }

  // Return the package only if some variants have been successfully loaded
  if (Object.keys(packageInfo.variants).length) {
    return packageInfo
  }
}

/**
 * Loads a variant from a package configuration.
 */
export function loadVariantInfo(variantId: string, packageData: PackageData): VariantInfo {
  const variantData = packageData.variants?.[variantId] ?? {}

  const variantInfo: VariantInfo = {
    assets: (packageData.assets || variantData.assets) && [
      ...(packageData.assets ?? []),
      ...(variantData.assets ?? []),
    ],
    authors: [...(packageData.authors ?? []), ...(variantData.authors ?? [])],
    category: variantData.category ?? packageData.category ?? defaultCategory,
    features: (packageData.features || variantData.features) && [
      ...(packageData.features ?? []),
      ...(variantData.features ?? []),
    ],
    dependencies: (packageData.dependencies || variantData.dependencies) && [
      ...(packageData.dependencies ?? []),
      ...(variantData.dependencies ?? []),
    ],
    deprecated: variantData.deprecated ?? packageData.deprecated,
    description: variantData.description ?? packageData.description,
    experimental: variantData.experimental ?? packageData.experimental,
    files: (packageData.files || variantData.files) && [
      ...(packageData.files ?? []),
      ...(variantData.files ?? []),
    ],
    id: variantId,
    images: (packageData.images || variantData.images) && [
      ...(packageData.images ?? []),
      ...(variantData.images ?? []),
    ],
    name: variantData.name ?? variantId,
    optional: (packageData.optional || variantData.optional) && [
      ...(packageData.optional ?? []),
      ...(variantData.optional ?? []),
    ],
    options: (packageData.options || variantData.options) && [
      ...(packageData.options ?? []),
      ...(variantData.options ?? []),
    ],
    readme: variantData.readme ?? packageData.readme,
    repository: variantData.repository ?? packageData.repository,
    requirements: (packageData.requirements || variantData.requirements) && {
      ...packageData.requirements,
      ...variantData.requirements,
    },
    thumbnail: variantData.thumbnail ?? packageData.thumbnail,
    url: variantData.url ?? packageData.url,
    version: variantData.version ?? packageData.version ?? "0.0.0",
    warnings: (packageData.warnings || variantData.warnings) && [
      ...(packageData.warnings ?? []),
      ...(variantData.warnings ?? []),
    ],
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

  for (const variantId in localPackageInfo.variants) {
    const localVariantInfo = localPackageInfo.variants[variantId]

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
  }

  for (const variantId in remotePackageInfo.variants) {
    localPackageInfo.variants[variantId] ??= remotePackageInfo.variants[variantId]
  }

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
      name: packageInfo.name,
      variants: Object.fromEntries(
        Object.entries(packageInfo.variants)
          .filter(([_, variant]) => !!variant.installed)
          .map<[string, VariantData]>(([id, variant]) => [
            id,
            {
              category: variant.category,
              features: variant.features?.length ? variant.features : undefined,
              dependencies: variant.dependencies?.length ? variant.dependencies : undefined,
              deprecated: variant.deprecated,
              description: variant.description,
              experimental: variant.experimental,
              files: variant.files,
              name: variant.name,
              readme: variant.readme,
              requirements: variant.requirements,
              version: variant.version,
            },
          ]),
      ),
    },
    newFormat,
    packageInfo.format,
  )

  packageInfo.format = newFormat
}
