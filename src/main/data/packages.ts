import fs from "fs/promises"
import path from "path"

import { glob } from "glob"
import { parse } from "yaml"

import { AssetInfo, PackageInfo, getDefaultVariant } from "@common/types"

import { getDatabasePath, getPackagesPath } from "../utils/paths"

import { loadYAMLRecursively } from "./utils"

interface VariantData {
  authors?: string[]
  dependencies?: string[]
  files?: {
    category?: number
    path: string
  }[]
  name?: string
  url?: string
  version?: string
}

interface PackageData extends VariantData {
  category?: number
  variants?: {
    [variant: string]: VariantData
  }
}

function isArrayOf<T>(value: unknown, predicate: (value: unknown) => value is T): value is T[] {
  return Array.isArray(value) && value.every(predicate)
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && !isNaN(new Date(value).getTime())
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function assert(condition: boolean, message?: string): asserts condition {
  if (!condition) {
    throw Error(message)
  }
}

export async function loadLocalPackages(): Promise<{ [id: string]: PackageInfo }> {
  console.info("Loading local packages...")

  const rootPath = getPackagesPath()

  let nPackages = 0
  const packages: { [id: string]: PackageInfo } = {}

  const authorEntries = await fs.readdir(rootPath, { withFileTypes: true })
  for (const authorEntry of authorEntries) {
    const authorPath = path.join(rootPath, authorEntry.name)
    if (authorEntry.isDirectory()) {
      const author = authorEntry.name
      const packageEntries = await fs.readdir(authorPath, { withFileTypes: true })
      for (const packageEntry of packageEntries) {
        const packagePath = path.join(authorPath, packageEntry.name)
        if (packageEntry.isDirectory()) {
          const packageId = `${author}/${packageEntry.name}`

          const variantEntries = await fs.readdir(packagePath, { withFileTypes: true })

          // console.log(`Found local package '${packageId}'`)

          const configEntry = variantEntries.find(
            entry => entry.isFile() && entry.name.match(/^package\.(json|ya?ml)$/),
          )

          let config: PackageData | undefined

          if (configEntry) {
            const configPath = path.join(packagePath, configEntry.name)
            const configData = await fs.readFile(configPath, "utf8")
            config = configPath.endsWith("json") ? JSON.parse(configData) : parse(configData)

            // console.log(`Found local package config '${configPath}'`)
          }

          const info: PackageInfo = {
            author,
            category: config?.category ?? 800,
            format: configEntry ? path.extname(configEntry.name) : undefined,
            id: packageId,
            name: config?.name ?? packageEntry.name,
            status: { enabled: false, variant: "default" },
            variants: {},
          }

          for (const variantEntry of variantEntries) {
            if (variantEntry.isDirectory() || variantEntry.isSymbolicLink()) {
              const variantId = variantEntry.name
              const variantConfig = config?.variants?.[variantId]

              // ~ is reserved for special folders, e.g. ~docs
              if (variantId === "~docs") {
                const files = await glob("*.{htm,html,md,txt}", {
                  cwd: path.join(packagePath, variantId),
                  matchBase: true,
                  nodir: true,
                })

                if (files.length) {
                  info.docs =
                    files.find(file => path.basename(file).match(/^index\.html?$/i)) ??
                    files.find(file => path.basename(file).match(/.*readme.*\.html?$/i)) ??
                    files.find(file => path.basename(file).match(/.*readme.*\.md?$/i)) ??
                    files.find(file => path.basename(file).match(/.*readme.*\.txt?$/i)) ??
                    files[0]

                  console.log(info.id, info.docs)
                }
              } else if (!variantId.startsWith("~")) {
                // console.log(`Found local package variant '${packageId}#${variantId}'`)
                info.variants[variantId] = {
                  assets: [],
                  compatible: true,
                  dependencies: Array.from(
                    new Set([
                      ...(config?.dependencies ?? []),
                      ...(variantConfig?.dependencies ?? []),
                    ]),
                  ),
                  files: [...(config?.files ?? []), ...(variantConfig?.files ?? [])],
                  id: variantId,
                  installed: variantConfig?.version ?? config?.version ?? "0",
                  local: true,
                  name: variantConfig?.name ?? config?.name ?? packageEntry.name,
                  version: variantConfig?.version ?? config?.version ?? "0",
                }
              }
            } else if (variantEntry !== configEntry) {
              console.warn(`Unexpected file '${packagePath}' inside Packages folder`)
            }
          }

          if (Object.keys(info.variants).length) {
            const defaultVariant = getDefaultVariant(info)
            info.status.variant = defaultVariant
            packages[packageId] = info
            nPackages++
          }

          if (info.author.length === 1) console.log(info)
        } else {
          console.warn(`Unexpected file '${packagePath}' inside Packages folder`)
        }
      }
    } else {
      console.warn(`Unexpected file '${authorPath}' inside Packages folder`)
    }
  }

  console.info(`Loaded ${nPackages} local packages`)

  return packages
}

export async function loadRemotePackages(): Promise<{
  assets: { [id: string]: AssetInfo }
  packages: { [id: string]: PackageInfo }
}> {
  console.info("Loading remote packages...")

  const rootPath = path.join(getDatabasePath(), "src", "yaml")
  const docs = await loadYAMLRecursively(rootPath)

  let nAssets = 0
  let nPackages = 0
  const assets: { [id: string]: AssetInfo } = {}
  const packages: { [id: string]: PackageInfo } = {}

  for (const doc of docs) {
    try {
      if (isObject(doc)) {
        if (doc.assetId) {
          assert(isString(doc.assetId), "'assetId' is not a string")
          assert(isDateString(doc.lastModified), "'lastModified' is not a date")
          assert(isString(doc.url), "'url' is not a string")
          assert(isString(doc.version), "'version' is not a string")

          const id = doc.assetId
          assert(!assets[id], `duplicate asset '${id}'`)

          assets[id] = {
            id,
            lastModified: new Date(doc.lastModified),
            url: doc.url,
            version: doc.version,
          }

          nAssets++
        } else if (isObject(doc.info)) {
          doc.assets ||= []
          doc.dependencies ||= []
          doc.variants ||= []

          assert(isString(doc.group), "'group' is not a string")
          assert(isString(doc.name), "'name' is not a string")

          const author = doc.group
          const id = `${author}/${doc.name}`
          assert(!packages[id], `duplicate package '${id}'`)

          assert(
            isArrayOf(doc.assets, isObject),
            `package '${id}' - 'assets' is not an array of objects`,
          )

          assert(
            isArrayOf(doc.dependencies, isString),
            `package '${id}' - 'dependencies' is not an array of strings`,
          )

          assert(
            isArrayOf(doc.variants, isObject),
            `package '${id}' - 'variants' is not an array of objects`,
          )

          assert(isObject(doc.info), `package '${id}' - 'info' is not an object`)
          assert(isString(doc.info.summary), `package '${id}' - 'info.summary' is not a string`)
          assert(isString(doc.subfolder), `package '${id}' - 'subfolder' is not a string`)
          assert(isString(doc.version), `package '${id}' - 'version' is not a string`)

          const subfolderMatch = doc.subfolder.match(/^(\d{3})(?:-(.+))$/)
          assert(subfolderMatch !== null, `package '${id}' - 'subfolder' is invalid`)
          const category = Number.parseInt(subfolderMatch[1], 10)
          assert(Number.isFinite(category), `package '${id}' - 'subfolder' is invalid`)

          const info: PackageInfo = {
            author,
            category,
            id,
            name: doc.info.summary,
            status: { enabled: false, variant: "default" },
            variants: {},
          }

          const commonAssets: { assetId: string; exclude?: string[]; include?: string[] }[] = []
          for (const asset of doc.assets) {
            assert(isString(asset.assetId), `package '${id}' - 'assetId' is not a string`)
            const info: { assetId: string; exclude?: string[]; include?: string[] } = {
              assetId: asset.assetId,
            }

            if (asset.exclude !== undefined) {
              assert(
                isArrayOf(asset.exclude, isString),
                `package '${id}' - 'exclude' is not an array of strings`,
              )
              info.exclude = asset.exclude
            }

            if (asset.include !== undefined) {
              assert(
                isArrayOf(asset.include, isString),
                `package '${id}' - 'include' is not an array of strings`,
              )
              info.include = asset.include
            }

            commonAssets.push(info)
          }

          const commonDependencies = doc.dependencies.map(id => id.replace(":", "/"))

          for (const variant of doc.variants) {
            variant.assets ||= []
            variant.dependencies ||= []

            assert(isObject(variant.variant), `package '${id}' - 'variant' is not an object`)
            const variantKey = Object.keys(variant.variant)[0]
            assert(isString(variantKey), `package '${id}' - variant key is not a string`)
            const variantValue = variant.variant[variantKey]
            assert(isString(variantValue), `package '${id}' - variant value is not a string`)

            const variantId = `${variantKey}=${variantValue}`

            const variantDescriptions = isObject(doc.variantDescriptions)
              ? doc.variantDescriptions[variantKey]
              : undefined

            const variantName = isObject(variantDescriptions)
              ? variantDescriptions[variantValue]
              : undefined

            assert(
              isArrayOf(variant.assets, isObject),
              `package '${id}' - 'assets' is not an array of objects`,
            )

            assert(
              isArrayOf(variant.dependencies, isString),
              `package '${id}' - 'dependencies' is not an array of strings`,
            )

            const variantAssets = [...commonAssets]
            for (const asset of variant.assets) {
              assert(isString(asset.assetId), `package '${id}' - 'assetId' is not a string`)
              const info: { assetId: string; exclude?: string[]; include?: string[] } = {
                assetId: asset.assetId,
              }

              if (asset.exclude !== undefined) {
                assert(
                  isArrayOf(asset.exclude, isString),
                  `package '${id}' - 'exclude' is not an array of strings`,
                )
                info.exclude = asset.exclude
              }

              if (asset.include !== undefined) {
                assert(
                  isArrayOf(asset.include, isString),
                  `package '${id}' - 'include' is not an array of strings`,
                )
                info.include = asset.include
              }

              variantAssets.push(info)
            }

            const variantDependencies = [
              ...commonDependencies,
              ...variant.dependencies.map(id => id.replace(":", "/")),
            ]

            info.variants[variantId] = {
              assets: variantAssets,
              compatible: true,
              dependencies: variantDependencies,
              id: variantId,
              name: isString(variantName) ? variantName : variantId,
              version: doc.version,
            }
          }

          if (Object.keys(info.variants).length) {
            info.status.variant = getDefaultVariant(info)
          } else {
            info.variants.default = {
              assets: commonAssets,
              compatible: true,
              dependencies: commonDependencies,
              id: "default",
              name: "Default",
              version: doc.version,
            }
          }

          packages[id] = info
          nPackages++
        }
      }
    } catch (error) {
      console.error(error)
    }
  }

  for (const id in packages) {
    const info = packages[id]
    for (const variant of Object.values(info.variants)) {
      if (variant?.dependencies) {
        for (const dependency of variant.dependencies) {
          try {
            assert(
              dependency in packages,
              `package '${id}' - dependency '${dependency}' does not exist`,
            )
          } catch (error) {
            console.error(error)
          }
        }
      }
    }
  }

  console.info(`Loaded ${nAssets} remote assets`)
  console.info(`Loaded ${nPackages} remote packages`)

  return { assets, packages }
}

export function toGlobPattern(pattern: string): string {
  if (pattern.startsWith("/")) {
    pattern = "**" + pattern
  }

  if (pattern.endsWith("/")) {
    pattern = pattern + "**"
  }

  return pattern
}
