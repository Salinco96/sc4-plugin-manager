import type { ID } from "@salinco/nice-utils"
import type { PackageID } from "./packages"

/** Collection ID */
export type CollectionID = ID<string, CollectionInfo>

export interface CollectionInfo {
  description?: string
  id: CollectionID
  images?: string[]
  lastGenerated?: Date
  lastModified?: Date
  name: string
  new?: boolean
  packages: PackageID[]
  release?: Date
  summary?: string
  thumbnail?: string
  url?: string
}

export type Collections = {
  [id in CollectionID]?: CollectionInfo
}
