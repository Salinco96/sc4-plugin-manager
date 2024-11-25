import fs from "node:fs/promises"
import path from "node:path"

import {
  filterValues,
  forEach,
  isEmpty,
  isNumber,
  isString,
  keys,
  mapDefined,
  mapValues,
  parseHex,
  size,
  toHex,
  union,
  unionBy,
  unique,
  values,
} from "@salinco/nice-utils"
import { glob } from "glob"

import type { AssetData, AssetID, Assets } from "@common/assets"
import type { AuthorID } from "@common/authors"
import { type Categories, CategoryID, type CategoryInfo } from "@common/categories"
import { OptionType } from "@common/options"
import { LOTS_OPTION_ID, MMPS_OPTION_ID, type PackageID, isNew } from "@common/packages"
import { ConfigFormat, type PackageData, type PackageInfo, type Packages } from "@common/types"
import {
  type DependencyData,
  type DependencyInfo,
  Menu,
  Submenu,
  type VariantAssetData,
  type VariantAssetInfo,
  type VariantID,
  type VariantInfo,
} from "@common/variants"
import { readConfig } from "@node/configs"
import { createIfMissing, exists } from "@node/files"
import { DIRNAMES, FILENAMES } from "@utils/constants"
import type { TaskContext } from "@utils/tasks"

import { loadAssetInfo } from "./assets"
import { loadOptionInfo } from "./options"

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
    name: packageData.name ?? packageId,
    status: {},
    variants: {},
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

      if (!variantInfo.authors.length) {
        const author = packageId.split("/")[0] as AuthorID
        variantInfo.authors.push(author)
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

        // Check assets and add inlined ones
        for (const variantInfo of values(packageInfo.variants)) {
          if (variantInfo.assets) {
            for (const asset of variantInfo.assets) {
              // Inline asset definition should have at least one of these
              if (asset.sha256 || asset.size || asset.url || asset.version) {
                if (assets[asset.id]) {
                  // Do not allow redefining an existing asset
                  context.raiseInDev(`Redefining asset ID ${asset.id}`)
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
    features: packageData.features,
    id: packageId,
    name: packageData.name ?? packageId,
    status: {},
    variants: {},
  }

  if (packageData.variants) {
    for (const variantId of keys(packageData.variants)) {
      // Skip disabled variants
      if (!packageData.variants[variantId]?.disabled) {
        const variantInfo = loadVariantInfo(packageId, variantId, packageData, categories)
        packageInfo.variants[variantId] = variantInfo
        if (!variantInfo.authors.length) {
          const author = packageId.split("/")[0] as AuthorID
          variantInfo.authors.push(author)
        }
      }
    }
  }

  // Return the package only if some variants have been successfully loaded
  if (!isEmpty(packageInfo.variants)) {
    return packageInfo
  }
}

function parseCategory(category: string, categories: Categories): CategoryID[] {
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

function loadPackageAssetInfo(data: VariantAssetData | AssetID): VariantAssetInfo {
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

function loadDependencyInfo(data: DependencyData | PackageID): DependencyInfo {
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
function loadVariantInfo(
  packageId: PackageID,
  variantId: VariantID,
  packageData: PackageData,
  categories: Categories,
): VariantInfo {
  const variantData = packageData.variants?.[variantId] ?? {}

  const authorId = packageId.split("/")[0] as AuthorID
  const category = variantData.category ?? packageData.category ?? CategoryID.MODS
  const subcategories = parseCategory(category, categories)
  const priorities = subcategories.map(categoryId => categories[categoryId]?.priority ?? 0)
  const priority = Math.max(...priorities)

  const variantInfo: VariantInfo = {
    authors: [authorId],
    categories: subcategories,
    id: variantId,
    name: variantData.name ?? variantId,
    priority,
    version: variantData.version ?? packageData.version ?? "0.0.0",
  }

  const assets = unionBy(
    variantData.assets?.map(loadPackageAssetInfo) ?? [],
    packageData.assets?.map(loadPackageAssetInfo) ?? [],
    asset => asset.id,
  )

  if (assets.length) {
    variantInfo.assets = assets
  }

  const authors = union(variantData.authors ?? [], packageData.authors ?? [])

  if (authors.length) {
    variantInfo.authors = union(variantInfo.authors, authors)
  }

  const dependencies = unionBy(
    variantData.dependencies?.map(loadDependencyInfo) ?? [],
    packageData.dependencies?.map(loadDependencyInfo) ?? [],
    dependency => dependency.id,
  )

  if (dependencies.length) {
    variantInfo.dependencies = dependencies
  }

  const deprecated = variantData.deprecated ?? packageData.deprecated

  if (deprecated) {
    variantInfo.deprecated = deprecated
  }

  const description = variantData.description ?? packageData.description

  if (description) {
    variantInfo.description = description
  }

  const experimental = variantData.experimental ?? packageData.experimental

  if (experimental) {
    variantInfo.experimental = experimental
  }

  const files = unionBy(variantData.files ?? [], packageData.files ?? [], file => file.path)

  if (files.length) {
    variantInfo.files = files
  }

  const images = union(variantData.images ?? [], packageData.images ?? [])

  if (images.length) {
    variantInfo.images = images
  }

  const logs = variantData.logs ?? packageData.logs

  if (logs) {
    variantInfo.logs = logs
  }

  const lots = unionBy(variantData.lots ?? [], packageData.lots ?? [], lot => lot.id)

  if (lots.length) {
    variantInfo.lots = lots.map(({ category, menu, submenu, ...lot }) => ({
      categories: category ? parseCategory(category, categories) : undefined,
      menu: menu ? parseMenu(menu) : undefined,
      submenus: submenu ? parseMenus(submenu) : undefined,
      ...lot,
    }))
  }

  const mmps = unionBy(variantData.mmps ?? [], packageData.mmps ?? [], mmp => mmp.id)

  if (mmps.length) {
    variantInfo.mmps = mmps.map(mmp =>
      mmp.category ? { categories: parseCategory(mmp.category, categories), ...mmp } : mmp,
    )
  }

  const optionalDependencies = union(variantData.optional ?? [], packageData.optional ?? [])

  if (optionalDependencies.length) {
    variantInfo.optional = optionalDependencies
  }

  const options = unionBy(
    mapDefined(variantData.options ?? [], loadOptionInfo),
    mapDefined(packageData.options ?? [], loadOptionInfo),
    option => option.id,
  )

  if (options.length) {
    variantInfo.options = options
  }

  const readme = variantData.readme ?? packageData.readme

  if (readme) {
    variantInfo.readme = readme
  }

  const release = variantData.release ?? packageData.release

  if (release) {
    variantInfo.release = release.toISOString()
  }

  if (isNew(variantInfo)) {
    variantInfo.new = true
  }

  const repository = variantData.repository ?? packageData.repository

  if (repository) {
    variantInfo.repository = repository
  }

  const requirements = { ...packageData.requirements, ...variantData.requirements }

  if (!isEmpty(requirements)) {
    variantInfo.requirements = requirements
  }

  const summary = variantData.summary ?? packageData.summary

  if (summary) {
    variantInfo.summary = summary
  }

  const support = variantData.support ?? packageData.support

  if (support) {
    variantInfo.support = support
  }

  const thumbnail = variantData.thumbnail ?? packageData.thumbnail

  if (thumbnail) {
    variantInfo.thumbnail = thumbnail
  }

  const url = variantData.url ?? packageData.url

  if (url) {
    variantInfo.url = url
  }

  const warnings = union(variantData.warnings ?? [], packageData.warnings ?? [])

  if (warnings.length) {
    variantInfo.warnings = warnings
  }

  // TODO: Do not write this into options explicitly!

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
          remoteVariantInfo.readme ??= localVariantInfo.readme
          remoteVariantInfo.files ??= localVariantInfo.files
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
        category: variant.categories.join(","),
        dependencies: variant.dependencies?.length ? variant.dependencies : undefined,
        deprecated: variant.deprecated,
        description: variant.description,
        experimental: variant.experimental,
        files: variant.files,
        images: variant.images,
        lastModified: variant.lastModified ? new Date(variant.lastModified) : undefined,
        logs: variant.logs,
        lots: variant.lots?.map(({ categories, menu, submenus, ...lot }) => ({
          category: categories?.join(","),
          menu: menu ? writeMenu(menu) : undefined,
          submenu: submenus?.length ? writeMenus(submenus) : undefined,
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
        release: variant.release ? new Date(variant.release) : undefined,
        repository: variant.repository,
        requirements: variant.requirements,
        summary: variant.summary,
        support: variant.support,
        thumbnail: variant.thumbnail,
        url: variant.url,
        version: variant.version,
        warnings: variant.warnings,
      }),
    ),
  }
}

export function parseMenu(menu: number | string): number {
  if (isNumber(menu)) {
    return menu
  }

  return Menu[menu as keyof typeof Menu] ?? Submenu[menu as keyof typeof Submenu] ?? parseHex(menu)
}

export function parseMenus(menus: number | string): number[] {
  if (isNumber(menus)) {
    return [menus]
  }

  return unique(menus.split(",").map(parseMenu))
}

export function writeMenu(menu: number): string {
  return Menu[menu] ?? Submenu[menu] ?? `0x${toHex(menu, 8)}`
}

export function writeMenus(menus: number[]): string {
  return menus.map(writeMenu).join(",")
}
