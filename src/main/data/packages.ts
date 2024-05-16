import fs from "fs/promises"
import path from "path"

import { parse } from "yaml"

import { AssetInfo, PackageInfo } from "@common/types"

import { getDatabasePath, getPackagesPath } from "../utils/paths"

import { loadYAMLRecursively } from "./utils"

// function isArray(value: unknown): value is unknown[] {
//   return Array.isArray(value)
// }

// interface RemoteAssetData {
//   archiveType?: { format: string; version: string }
//   assetId: string
//   lastModified: string
//   url: string
//   version: string
// }

// interface RemotePackageData {
//   assets?: { assetId: string; include?: string[] }[]
//   dependencies?: string[]
//   group: string
//   info?: {
//     author?: string
//     conflicts?: string
//     description?: string
//     summary?: string
//     warning?: string
//     website?: string
//   }
//   name: string
//   subfolder: string
//   variantDescriptions?: { [key: string]: { [value: string]: string } }
//   variants?: {
//     assets: { assetId: string; include?: string[] }[]
//     dependencies?: string[]
//     variant: { [key: string]: string }
//   }[]
//   version: string
// }

interface PackageVariantData {
  authors?: string[]
  category?: number
  dependencies?: string[]
  include?: { source: string }[]
  name?: string
  url?: string
  version?: string
}

interface PackageData extends PackageVariantData {
  variants?: {
    [variant: string]: PackageVariantData
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

          console.log(`Found local package '${packageId}'`)

          const configEntry = variantEntries.find(
            entry => entry.isFile() && entry.name.match(/^package\.(json|ya?ml)$/),
          )

          let config: PackageData | undefined

          if (configEntry) {
            const configPath = path.join(packagePath, configEntry.name)
            const configData = await fs.readFile(configPath, "utf8")
            config = configPath.endsWith("json") ? JSON.parse(configData) : parse(configData)

            console.log(`Found local package config '${configPath}'`)
          }

          for (const variantEntry of variantEntries) {
            if (variantEntry.isDirectory() || variantEntry.isSymbolicLink()) {
              const variantId = variantEntry.name

              // ~ is reserved for special folders, e.g. ~docs
              if (!variantId.startsWith("~")) {
                console.log(`Found local package variant '${packageId}#${variantId}'`)
              }
            } else if (variantEntry !== configEntry) {
              console.warn(`Unexpected file '${packagePath}' inside Packages folder`)
            }
          }

          packages[packageId] = {
            author,
            authors: config?.authors ?? [author],
            category: config?.category ?? 800,
            dependencies: config?.dependencies ?? [],
            id: packageId,
            installed: config?.version ?? "0",
            name: config?.name ?? packageEntry.name,
            version: config?.version ?? "0",
          }

          nPackages++
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
        }

        if (isObject(doc.info)) {
          doc.dependencies ||= []

          assert(isString(doc.group), "'group' is not a string")
          assert(isString(doc.name), "'name' is not a string")

          const author = doc.group
          const id = `${author}/${doc.name}`
          assert(!packages[id], `duplicate package '${id}'`)

          assert(
            isArrayOf(doc.dependencies, isString),
            `package '${id}' - 'dependencies' is not an array of strings`,
          )

          assert(isObject(doc.info), `package '${id}' - 'info' is not an object`)
          assert(isString(doc.info.summary), `package '${id}' - 'info.summary' is not a string`)
          assert(isString(doc.subfolder), `package '${id}' - 'subfolder' is not a string`)
          assert(isString(doc.version), `package '${id}' - 'version' is not a string`)

          const subfolderMatch = doc.subfolder.match(/^(\d{3})(?:-(.+))$/)
          assert(subfolderMatch !== null, `package '${id}' - 'subfolder' is invalid`)
          const category = Number.parseInt(subfolderMatch[1], 10)
          assert(Number.isFinite(category), `package '${id}' - 'subfolder' is invalid`)

          packages[id] = {
            assets: doc.assets as { assetId: string }[], // TODO
            author,
            authors: [author],
            category,
            dependencies: doc.dependencies.map(id => id.replace(":", "/")),
            id,
            name: doc.info.summary,
            version: doc.version,
          }

          nPackages++
        }
      }
    } catch (error) {
      console.error(error)
    }
  }

  for (const id in packages) {
    const info = packages[id]
    for (const dependency of info.dependencies) {
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

  console.info(`Loaded ${nAssets} remote assets`)
  console.info(`Loaded ${nPackages} remote packages`)

  return { assets, packages }
}
