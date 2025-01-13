import type { CollectionID, CollectionInfo, Collections } from "@common/collections"
import { type PackageID, isNew } from "@common/packages"
import { ConfigFormat } from "@common/types"
import { loadConfig, writeConfig } from "@node/configs"
import type { TaskContext } from "@node/tasks"
import { mapValues, size } from "@salinco/nice-utils"

const COLLECTIONS_CONFIG_NAME = "configs/collections"

export interface CollectionData {
  description?: string
  images?: string[]
  lastGenerated?: Date | string
  lastModified?: Date | string
  name: string
  packages: PackageID[]
  release?: Date | string
  summary?: string
  thumbnail?: string
  url?: string
}

export async function loadCollections(
  context: TaskContext,
  basePath: string,
): Promise<Collections> {
  context.debug("Loading collections...")

  try {
    const config = await loadConfig<{ [id in CollectionID]?: CollectionData }>(
      basePath,
      COLLECTIONS_CONFIG_NAME,
    )

    if (!config) {
      throw Error(`Missing config ${COLLECTIONS_CONFIG_NAME}`)
    }

    const collections = mapValues(config.data, (data, id) => loadCollectionInfo(id, data))

    context.debug(`Loaded ${size(collections)} collections`)
    return collections
  } catch (error) {
    context.error("Failed to load collections", error)
    return {}
  }
}

export async function writeCollections(
  context: TaskContext,
  basePath: string,
  collections: Collections,
): Promise<void> {
  context.debug("Writing collections...")

  await writeConfig<{ [id in CollectionID]?: CollectionData }>(
    basePath,
    COLLECTIONS_CONFIG_NAME,
    mapValues(collections, writeCollectionInfo),
    ConfigFormat.YAML,
  )
}

function loadCollectionInfo(id: CollectionID, data: CollectionData): CollectionInfo {
  const collection: CollectionInfo = {
    description: data.description,
    id,
    images: data.images,
    lastGenerated: data.lastGenerated ? new Date(data.lastGenerated) : undefined,
    lastModified: data.lastModified ? new Date(data.lastModified) : undefined,
    name: data.name,
    packages: data.packages,
    release: data.release ? new Date(data.release) : undefined,
    summary: data.summary,
    thumbnail: data.thumbnail,
    url: data.url,
  }

  collection.new = isNew(collection)

  return collection
}

function writeCollectionInfo(collection: CollectionInfo): CollectionData {
  return {
    description: collection.description,
    images: collection.images,
    lastGenerated: collection.lastGenerated,
    lastModified: collection.lastModified,
    name: collection.name,
    packages: collection.packages,
    release: collection.release,
    summary: collection.summary,
    thumbnail: collection.thumbnail,
    url: collection.url,
  }
}
