import { CollectionInfo } from "@common/types"

import { getCollectionsPath } from "../utils/paths"

import { loadYAMLRecursively } from "./utils"

export async function loadCollections(): Promise<CollectionInfo[]> {
  console.info("Loading collections...")

  const collections = await loadYAMLRecursively<CollectionInfo>(getCollectionsPath())

  console.info(`Loaded ${collections.length} collections`)

  return collections
}
