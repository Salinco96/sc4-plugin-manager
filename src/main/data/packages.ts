import fs from "fs/promises"
import path from "path"

import { glob } from "glob"

import { CategoryID, parseCategoryID } from "@common/categories"
import { ProfileSettings } from "@common/profiles"
import {
  PackageAsset,
  PackageData,
  PackageInfo,
  VariantData,
  VariantInfo,
  AssetInfo,
  ConfigFormat,
  DEFAULT_VARIANT_ID,
  ProfileInfo,
  getDefaultVariant,
} from "@common/types"
import { readConfig, readConfigs, writeConfig } from "@utils/configs"
import { FILENAMES } from "@utils/constants"
import { exists } from "@utils/files"

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
): Promise<{ [packageId: string]: PackageInfo }> {
  console.info("Loading local packages...")

  const packages: { [packageId: string]: PackageInfo } = {}

  const authorEntries = await fs.readdir(basePath, { withFileTypes: true })
  for (const authorEntry of authorEntries) {
    if (authorEntry.isDirectory()) {
      const authorPath = path.join(basePath, authorEntry.name)
      const packageEntries = await fs.readdir(authorPath, { withFileTypes: true })
      for (const packageEntry of packageEntries) {
        if (packageEntry.isDirectory()) {
          const packageId = `${authorEntry.name}/${packageEntry.name}`
          const packagePath = path.join(authorPath, packageEntry.name)
          const packageInfo = await loadLocalPackageInfo(packageId, packagePath)
          if (packageInfo) {
            packages[packageId] = packageInfo
          }
        }
      }
    }
  }

  console.info(`Loaded ${Object.keys(packages).length} local packages`)

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
    status: {
      enabled: false,
      options: {},
      requiredBy: [],
      variantId: DEFAULT_VARIANT_ID,
    },
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
      if (!variantInfo.authors.length) {
        variantInfo.authors.push(packageId.split("/")[0])
      }
    }
  }

  // Select default variant
  if (!packageInfo.variants[DEFAULT_VARIANT_ID]) {
    packageInfo.status.variantId = Object.keys(packageInfo.variants)[0]
  }

  // Return the package only if some variants have been successfully loaded
  if (packageInfo.status.variantId) {
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

  return pattern
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
export async function loadRemotePackages(basePath: string): Promise<{
  assets: { [assetId: string]: AssetInfo }
  packages: { [packageId: string]: PackageInfo }
}> {
  console.info("Loading remote packages...")

  const assets: { [assetId: string]: AssetInfo } = {}
  const packages: { [packageId: string]: PackageInfo } = {}

  // TODO: Remove when own data repository has some interesting content?
  const memoPath = path.join(basePath, "src/yaml")
  if (await exists(memoPath)) {
    const configEntries = await glob("**/*.{yaml,yml}", { cwd: memoPath })
    for (const configEntry of configEntries) {
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
        } else {
          const packageId = `${config.group}/${config.name}`
          const packageInfo: PackageInfo = {
            id: packageId,
            name: config.info?.summary ?? packageId,
            status: {
              enabled: false,
              options: {},
              requiredBy: [],
              variantId: DEFAULT_VARIANT_ID,
            },
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
                deprecated: !!config.info?.summary?.match(/superseded/i),
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

              if (camMods.includes(packageId)) {
                if (variantId === "cam=no") {
                  continue
                }

                variantInfo.conflictGroups ??= []
                variantInfo.conflictGroups.push("cam")
              }

              if (darkniteMods.includes(packageId)) {
                if (variantId === "nightmode=standard") {
                  continue
                }

                variantInfo.conflictGroups ??= []
                variantInfo.conflictGroups.push("darknite")
              }

              if (variantId === "nightmode=standard") {
                variantInfo.name = "Maxis Nite"
                variantInfo.requirements ??= {}
                variantInfo.requirements.darknite = false
              }

              if (variantId === "nightmode=dark") {
                variantInfo.name = "Dark Nite"
                if (!darkniteMods.includes(packageId)) {
                  variantInfo.requirements ??= {}
                  variantInfo.requirements.darknite = true
                }
              }

              if (variantId === "cam=yes") {
                variantInfo.name = "CAM"
                if (!camMods.includes(packageId)) {
                  variantInfo.requirements ??= {}
                  variantInfo.requirements.cam = true
                }
              }

              if (variantId === "cam=no") {
                variantInfo.name = "Standard"
                variantInfo.requirements ??= {}
                variantInfo.requirements.cam = false
              }

              if (variantId === "driveside=left") {
                variantInfo.name = "Right-Hand Drive"
                variantInfo.requirements ??= {}
                variantInfo.requirements.rhd = true
              }

              if (variantId === "driveside=right") {
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
              deprecated: !!config.info?.summary?.match(/superseded/i),
              description: config.info?.description,
              id: variantId,
              name: variantId,
              url: config.info?.website,
              version: config.version,
            }

            packageInfo.variants[variantId] = defaultVariantInfo
          }

          // Select default variant
          if (!packageInfo.variants[DEFAULT_VARIANT_ID]) {
            packageInfo.status.variantId = Object.keys(packageInfo.variants)[0]
          }

          // Return the package only if some variants have been successfully loaded
          if (packageInfo.status.variantId) {
            packages[packageId] = packageInfo
          }
        }
      }
    }
  } else {
    const dataPath = path.join(basePath, "packages")
    const configEntries = await glob("**/*.{yaml,yml}", { cwd: dataPath })
    for (const configEntry of configEntries) {
      const configPath = path.join(dataPath, configEntry)
      // TODO: This assumes that configs are correctly formatted
      const configs = await readConfig<{ [packageId: string]: PackageData }>(configPath)
      for (const packageId in configs) {
        const packageInfo = loadRemotePackageInfo(packageId, configs[packageId])
        if (packageInfo) {
          packages[packageId] = packageInfo
        }
      }
    }
  }

  console.info(`Loaded ${Object.keys(packages).length} remote packages`)

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
    status: {
      enabled: false,
      options: {},
      requiredBy: [],
      variantId: DEFAULT_VARIANT_ID,
    },
    variants: {},
  }

  for (const variantId in packageData.variants) {
    const variantInfo = loadVariantInfo(variantId, packageData)
    packageInfo.variants[variantId] = variantInfo
    if (!variantInfo.authors.length) {
      variantInfo.authors.push(packageId.split("/")[0])
    }
  }

  // Select default variant
  if (!packageInfo.variants[DEFAULT_VARIANT_ID]) {
    packageInfo.status.variantId = Object.keys(packageInfo.variants)[0]
  }

  // Return the package only if some variants have been successfully loaded
  if (packageInfo.status.variantId) {
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
    docs: (packageData.docs || variantData.docs) && {
      ...packageData.docs,
      ...variantData.docs,
    },
    experimental: variantData.experimental ?? packageData.experimental,
    files: (packageData.files || variantData.files) && [
      ...(variantData.files ?? []),
      ...(packageData.files ?? []),
    ],
    id: variantId,
    name: variantData.name ?? variantId,
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
        remoteVariantInfo.docs ??= localVariantInfo.docs
        remoteVariantInfo.files ??= localVariantInfo.files
        Object.assign(localVariantInfo, remoteVariantInfo)
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
              assets: variant.assets?.length ? variant.assets : undefined,
              category: variant.category,
              conflictGroups: variant.conflictGroups?.length ? variant.conflictGroups : undefined,
              dependencies: variant.dependencies?.length ? variant.dependencies : undefined,
              deprecated: variant.deprecated,
              description: variant.description,
              docs: variant.docs,
              experimental: variant.experimental,
              files: variant.files,
              name: variant.name,
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

export function checkoutPackages(
  packages: { [packageId: string]: PackageInfo },
  profile: ProfileInfo,
): void {
  // Enable explicit packages
  for (const packageId in packages) {
    const packageConfig = profile.packages[packageId]
    const packageInfo = packages[packageId]

    packageInfo.status.enabled = false
    packageInfo.status.options = packageConfig?.options ?? {}
    packageInfo.status.requiredBy = []

    if (packageConfig?.variant) {
      if (packageInfo.variants[packageConfig.variant]) {
        packageInfo.status.variantId = packageConfig.variant
      } else {
        console.warn(`Unknown package variant '${packageId}#${packageConfig.variant}'`)
        packageInfo.status.variantId = getDefaultVariant(packageInfo).id
      }
    } else {
      packageInfo.status.variantId = getDefaultVariant(packageInfo).id
    }
  }

  // Enable dependencies recursively
  const enableRecursively = (packageInfo: PackageInfo) => {
    if (!packageInfo.status.enabled) {
      packageInfo.status.enabled = true

      const variantInfo = packageInfo.variants[packageInfo.status.variantId]
      variantInfo.dependencies?.forEach(dependencyId => {
        const dependencyInfo = packages[dependencyId]
        if (dependencyInfo) {
          dependencyInfo.status.requiredBy.push(packageInfo.id)
          enableRecursively(dependencyInfo)
        } else {
          console.warn(`Unknown dependency '${dependencyId}'`)
        }
      })
    }
  }

  for (const packageId in profile.packages) {
    const packageConfig = profile.packages[packageId]
    const packageInfo = packages[packageId]
    if (packageConfig?.enabled) {
      if (packageInfo) {
        enableRecursively(packageInfo)
      } else {
        console.warn(`Unknown package '${packageId}'`)
      }
    }
  }
}

export function calculatePackageCompatibility(
  packages: { [packageId: string]: PackageInfo },
  settings: ProfileSettings,
): {
  conflictGroups: { [group: string]: string[] }
  requirements: { [requirement: string]: { [value: string]: string[] } }
} {
  const conflictGroups: { [group: string]: string[] } = {}
  const requirements: { [requirement: string]: { [value: string]: string[] } } = {}

  // Calculate conflict groups and requirements
  for (const packageId in packages) {
    const packageInfo = packages[packageId]
    if (packageInfo.status.enabled) {
      const variantInfo = packageInfo.variants[packageInfo.status.variantId]

      // Add conflict groups
      if (variantInfo.conflictGroups) {
        for (const conflictGroup of variantInfo.conflictGroups) {
          conflictGroups[conflictGroup] ??= []
          conflictGroups[conflictGroup].push(packageId)
        }
      }

      // Add requirements
      if (variantInfo.requirements) {
        for (const requirement in variantInfo.requirements) {
          const value = String(variantInfo.requirements[requirement])
          requirements[requirement] ??= {}
          requirements[requirement][value] ??= []
          requirements[requirement][value].push(packageId)
        }
      }
    }
  }

  // Check conflict groups
  for (const conflictGroup in conflictGroups) {
    const packageIds = conflictGroups[conflictGroup]
    if (packageIds.length > 1) {
      // TODO: Store the issue
      console.warn(
        `Multiple enabled packages with conflict group '${conflictGroup}': ${packageIds.join(", ")}`,
      )
    }
  }

  if (settings.cam) {
    conflictGroups.cam ??= ["<external>"]
  }

  if (settings.darknite) {
    conflictGroups.darknite ??= ["<external>"]
  }

  // Check requirements
  for (const requirement in requirements) {
    const values = Object.entries(requirements[requirement])
    if (values.length > 1) {
      // TODO: Store the issue
      console.warn(
        `Conflicting values for requirement '${requirement}': ${values.map(([value, packageIds]) => `'${value}' required by ${packageIds.join(", ")}`).join(" - ")}`,
      )
    }
  }

  // Calculate compatibility recursively
  const cache = new Map<string, boolean>()
  const checkRecursively = (packageInfo: PackageInfo): boolean => {
    const cached = cache.get(packageInfo.id)
    if (cached !== undefined) {
      return cached
    }

    // Treated as compatible case of circular dependency
    cache.set(packageInfo.id, true)

    let packageCompatible = false

    for (const variantId in packageInfo.variants) {
      const variantInfo = packageInfo.variants[variantId]

      calculateVariantCompatibility(
        packageInfo.id,
        variantInfo,
        settings,
        conflictGroups,
        requirements,
      )

      if (!variantInfo.incompatible && variantInfo.dependencies) {
        const incompatibleDependencyIds = variantInfo.dependencies.filter(dependencyId => {
          const dependencyInfo = packages[dependencyId]
          return !!dependencyInfo && !checkRecursively(dependencyInfo)
        })

        if (incompatibleDependencyIds.length) {
          if (incompatibleDependencyIds.length === 1) {
            variantInfo.incompatible = [
              `Dependency ${incompatibleDependencyIds[0]} is not compatible`,
            ]
          } else {
            variantInfo.incompatible = [
              `${incompatibleDependencyIds.length} dependencies are not compatible`,
            ]
          }
        }
      }

      packageCompatible ||= !variantInfo.incompatible

      delete variantInfo.issues
      if (packageInfo.status.enabled && packageInfo.status.variantId === variantId) {
        const issues: string[] = []

        if (!variantInfo.installed) {
          if (Object.values(packageInfo.variants).some(variant => variant.installed)) {
            issues.push("The selected variant is not installed.")
          } else {
            issues.push("This package is not installed.")
          }
        }

        if (variantInfo.incompatible) {
          issues.push(...variantInfo.incompatible)
          delete variantInfo.incompatible
        }

        if (issues.length) {
          variantInfo.issues = issues
        }
      }
    }

    cache.set(packageInfo.id, packageCompatible)
    return packageCompatible
  }

  for (const packageId in packages) {
    const packageInfo = packages[packageId]

    checkRecursively(packageInfo)

    // Calculate new default variant if selected variant is incompatible
    if (packageInfo.variants[packageInfo.status.variantId].incompatible) {
      packageInfo.status.variantId = getDefaultVariant(packageInfo).id
    }
  }

  return { conflictGroups, requirements }
}

function calculateVariantCompatibility(
  packageId: string,
  variantInfo: VariantInfo,
  settings: ProfileSettings,
  conflictGroups: { [group: string]: string[] },
  requirements: { [requirement: string]: { [value: string]: string[] } },
): boolean {
  const incompatible: string[] = []

  // Check conflict groups
  if (variantInfo.conflictGroups) {
    for (const conflictGroup of variantInfo.conflictGroups) {
      const conflictPackageIds = conflictGroups[conflictGroup]
      const conflictPackageId = conflictPackageIds?.find(id => id !== packageId)
      if (conflictPackageId) {
        incompatible.push(`Conflicting with ${conflictPackageId}`)
      }
    }
  }

  // Check requirements
  if (variantInfo.requirements) {
    for (const requirement in variantInfo.requirements) {
      const value = variantInfo.requirements[requirement]

      // Check conflict groups
      const valueInSettings = settings[requirement as keyof ProfileSettings]
      const hasConflictGroup = !!conflictGroups[requirement]?.length
      if ((valueInSettings || hasConflictGroup) !== value) {
        incompatible.push(`Requires ${requirement}${value ? "" : " not"} to be present`)
      }

      // Check other requirements
      if (requirements[requirement] !== undefined) {
        for (const requiredValue in requirements[requirement]) {
          if (requiredValue !== String(value)) {
            const conflictPackageId = requirements[requirement][requiredValue][0]
            if (conflictPackageId) {
              incompatible.push(`Conflicting requirement ${requirement} with ${conflictPackageId}`)
            }
          }
        }
      }
    }
  }

  if (incompatible.length === 0) {
    delete variantInfo.incompatible
    return true
  } else {
    variantInfo.incompatible = incompatible
    return false
  }
}
