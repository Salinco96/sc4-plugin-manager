import fs from "fs/promises"
import path from "path"

import { glob } from "glob"

import { CategoryID, parseCategoryID } from "@common/categories"
import {
  PackageAsset,
  PackageData,
  PackageInfo,
  VariantData,
  VariantInfo,
  AssetInfo,
  ConfigFormat,
  DEFAULT_VARIANT_ID,
} from "@common/types"
import { readConfig, readConfigs, writeConfig } from "@utils/configs"
import { DIRNAMES, FILENAMES } from "@utils/constants"
import { isDev } from "@utils/env"
import { exists } from "@utils/files"

import { loadAssetInfo } from "./assets"

interface MemoAssetData {
  assetId: string
  lastModified: string
  url: string
  version: string
}

interface MemoPackageAsset {
  assetId: string
  exclude?: string[]
  include?: string[]
}

interface MemoPackageData {
  assets?: MemoPackageAsset[]
  dependencies?: string[]
  group: string
  info?: {
    author?: string
    conflicts?: string
    description?: string
    summary?: string
    website?: string
  }
  name: string
  subfolder: string
  variantDescriptions?: {
    [key: string]: {
      [value: string]: string
    }
  }
  variants?: {
    assets: MemoPackageAsset[]
    dependencies?: string[]
    variant: {
      [key: string]: string
    }
  }[]
  version: string
}

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
 * Converts an asset reference from memo33's format to our own.
 */
export function convertMemoAsset(asset: MemoPackageAsset): PackageAsset {
  return {
    id: asset.assetId,
    include: asset.include?.map(pattern => ({ path: convertMemoPattern(pattern) })),
    exclude: asset.exclude?.map(pattern => ({ path: convertMemoPattern(pattern) })),
  }
}

/**
 * Converts an author list from memo33's format to our own.
 */
export function convertMemoAuthors(authors: string): string[] {
  return authors.replace(/\s*and many others$/i, "").split(/,\s*/)
}

/**
 * Converts a file pattern from memo33's format to a {@link glob} pattern.
 */
export function convertMemoPattern(pattern: string): string {
  if (pattern.startsWith("/")) {
    pattern = "**" + pattern
  } else {
    pattern = "**/" + pattern
  }

  if (pattern.endsWith("/")) {
    pattern = pattern + "**"
  } else if (!pattern.match(/\.[^/]*$/)) {
    pattern = pattern + "/**"
  }

  return pattern.replace(/\.(?!_?[a-z0-9]+$)/i, "?")
}

/**
 * Converts a package ID from memo33's format to our own.
 */
export function convertMemoPackageId(packageId: string): string {
  return packageId.replace(":", "/")
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

  // TODO: Remove when own data repository has some interesting content?
  const memoPath = path.join(basePath, DIRNAMES.dbMemo)
  const isMemo = await exists(memoPath)

  if (isMemo) {
    const configEntries = await glob("**/*.{yaml,yml}", { cwd: memoPath })

    for (const configEntry of configEntries) {
      onProgress(nConfigs++, configEntries.length)
      const configPath = path.join(memoPath, configEntry)

      // TODO: This assumes that configs are correctly formatted
      const configs = await readConfigs<MemoAssetData | MemoPackageData>(configPath)
      for (const config of configs) {
        if ("assetId" in config) {
          const assetInfo: AssetInfo = {
            id: config.assetId,
            lastModified: new Date(config.lastModified),
            url: config.url,
            version: config.version,
          }

          assets[assetInfo.id] = assetInfo
          nAssets++
        } else {
          const packageId = `${config.group}/${config.name}`
          const packageInfo: PackageInfo = {
            id: packageId,
            name: config.info?.summary ?? packageId,
            status: {},
            variants: {},
          }

          if (config.variants) {
            for (const variant of config.variants) {
              const variantKeyValues = Object.entries(variant.variant)
              const variantId = variantKeyValues
                .map(([k, v]) => `${k}=${v}`)
                .join("&")
                .toLowerCase()

              const [[key, value]] = variantKeyValues

              const variantInfo: VariantInfo = {
                assets: (config.assets || variant.assets) && [
                  ...(variant.assets ?? []).map(convertMemoAsset),
                  ...(config.assets ?? []).map(convertMemoAsset),
                ],
                authors: convertMemoAuthors(config.info?.author ?? config.group),
                category: parseCategoryID(config.subfolder),
                dependencies: (variant.dependencies ?? variant.dependencies) && [
                  ...(variant.dependencies ?? []).map(convertMemoPackageId),
                  ...(config.dependencies ?? []).map(convertMemoPackageId),
                ],
                deprecated: config.info?.summary?.match(/superseded/i) ? true : undefined,
                description: config.info?.description,
                id: variantId,
                name: config.variantDescriptions?.[key]?.[value] ?? variantId,
                url: config.info?.website,
                version: config.version,
              }

              // Fix CAM/DarkNite compatibility format
              const camMods = ["cam/colossus-addon-mod"]
              const darkniteMods = ["simfox/day-and-nite-mod"]

              variantInfo.dependencies = variantInfo.dependencies?.filter(
                dependencyId => !darkniteMods.includes(dependencyId),
              )

              // TODO: Improve this logic

              if (camMods.includes(packageId)) {
                if (variantId.includes("cam=no")) {
                  continue
                }

                variantInfo.conflictGroups ??= []
                variantInfo.conflictGroups.push("cam")
              }

              if (darkniteMods.includes(packageId)) {
                if (variantId.includes("nightmode=standard")) {
                  continue
                }

                variantInfo.conflictGroups ??= []
                variantInfo.conflictGroups.push("darknite")
              }

              if (variantId.includes("nightmode=standard")) {
                variantInfo.name = "Maxis Nite"
                variantInfo.requirements ??= {}
                variantInfo.requirements.darknite = false
              }

              if (variantId.includes("nightmode=dark")) {
                variantInfo.name = "Dark Nite"
                if (!darkniteMods.includes(packageId)) {
                  variantInfo.requirements ??= {}
                  variantInfo.requirements.darknite = true
                }
              }

              if (variantId.includes("cam=yes")) {
                variantInfo.name = "CAM"
                if (!camMods.includes(packageId)) {
                  variantInfo.requirements ??= {}
                  variantInfo.requirements.cam = true
                }
              }

              if (variantId.includes("cam=no")) {
                variantInfo.name = "Standard"
                variantInfo.requirements ??= {}
                variantInfo.requirements.cam = false
              }

              if (variantId.includes("driveside=left")) {
                variantInfo.name = "Right-Hand Drive"
                variantInfo.requirements ??= {}
                variantInfo.requirements.rhd = true
              }

              if (variantId.includes("driveside=right")) {
                variantInfo.name = "Left-Hand Drive"
                variantInfo.requirements ??= {}
                variantInfo.requirements.rhd = false
              }

              packageInfo.variants[variantId] = variantInfo
            }
          } else {
            const variantId = DEFAULT_VARIANT_ID

            const defaultVariantInfo: VariantInfo = {
              assets: config.assets?.map(convertMemoAsset),
              authors: convertMemoAuthors(config.info?.author ?? config.group),
              category: parseCategoryID(config.subfolder),
              dependencies: config.dependencies?.map(convertMemoPackageId),
              deprecated: config.info?.summary?.match(/superseded/i) ? true : undefined,
              description: config.info?.description,
              id: variantId,
              name: variantId,
              url: config.info?.website,
              version: config.version,
            }

            packageInfo.variants[variantId] = defaultVariantInfo
          }

          // Return the package only if some variants have been successfully loaded
          if (Object.keys(packageInfo.variants).length) {
            packages[packageId] = packageInfo
            nPackages++
          }
        }
      }
    }
  } else {
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
      ...(variantData.assets ?? []),
      ...(packageData.assets ?? []),
    ],
    authors: [...(variantData.authors ?? []), ...(packageData.authors ?? [])],
    category: (variantData.category ?? packageData.category ?? 800) as CategoryID,
    conflictGroups: (packageData.conflictGroups || variantData.conflictGroups) && [
      ...(variantData.conflictGroups ?? []),
      ...(packageData.conflictGroups ?? []),
    ],
    dependencies: (packageData.dependencies || variantData.dependencies) && [
      ...(variantData.dependencies ?? []),
      ...(packageData.dependencies ?? []),
    ],
    deprecated: variantData.deprecated ?? packageData.deprecated,
    description: variantData.description ?? packageData.description,
    experimental: variantData.experimental ?? packageData.experimental,
    files: (packageData.files || variantData.files) && [
      ...(variantData.files ?? []),
      ...(packageData.files ?? []),
    ],
    id: variantId,
    name: variantData.name ?? variantId,
    readme: variantData.readme ?? packageData.readme,
    repository: variantData.repository ?? packageData.repository,
    requirements: (packageData.requirements || variantData.requirements) && {
      ...packageData.requirements,
      ...variantData.requirements,
    },
    url: variantData.url ?? packageData.url,
    version: variantData.version ?? packageData.version ?? "0.0.0",
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
              conflictGroups: variant.conflictGroups?.length ? variant.conflictGroups : undefined,
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
