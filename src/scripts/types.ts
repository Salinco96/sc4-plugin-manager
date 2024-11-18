import { HTMLElement } from "node-html-parser"

import { AssetID } from "@common/assets"
import { PackageID } from "@common/packages"
import { BuildingData, Feature, ID, LotData } from "@common/types"
import { VariantID } from "@common/variants"

export interface IndexerOptions {
  include: {
    authors: string[]
    entries: string[]
  }
  refetchIntervalHours: number
  sources: IndexerSource[]
  version: number
}

/**
 * Basic mod data, which can be extracted from the mod listing, without fetching the individual mod page.
 */
export interface IndexerBaseEntry {
  /** Manager asset ID */
  assetId: AssetID
  authors: string[]
  downloads?: number
  lastModified: Date
  name?: string
  thumbnail?: string
  url?: string
}

/**
 * Enhanced mod data, which is extracted from the individual mod page.
 */
export interface IndexerEntryDetails {
  dependencies?: string[]
  description?: string
  images?: string[]
  repository?: string
  version?: string
}

export interface IndexerVariantEntry {
  buildings?: BuildingData[]
  download?: string
  features?: Feature[]
  filename?: string
  files?: string[]
  lots?: LotData[]
  models?: string[]
  props?: string[]
  /** Download hash */
  sha256?: string
  /** Download size in bytes */
  size?: number
  textures?: string[]
  /** Uncompressed size in bytes, if download is compressed */
  uncompressed?: number
}

export interface IndexerEntry extends IndexerBaseEntry, IndexerEntryDetails, IndexerVariantEntry {
  /** Category ID within the source (e.g. "101-residential" in Simtropolis) */
  category?: IndexerSourceCategoryID
  /** Indexer metadata */
  meta?: {
    /** When were this entry's details last extracted */
    timestamp?: Date
    /** With which indexer version were this entry's files last extracted */
    version?: number
  }
  variants?: {
    /** Variant is the Simtropolis "r" download ID, not the human-readable package variant ID */
    [variant in string]?: IndexerVariantEntry
  }
}

export type EntryID = `${IndexerSourceID}/${number}`

export interface IndexerEntryList {
  assets: {
    [entryId in EntryID]?: IndexerEntry
  }
  /** Indexer metadata */
  meta?: {
    /** When was this listing last extracted */
    timestamp?: Date
  }
}

export type IndexerSourceID = ID<IndexerSource>

export interface IndexerSource {
  categories: { [id: IndexerSourceCategoryID]: IndexerSourceCategory }
  getCategoryPageCount(html: HTMLElement): number
  getCategoryUrl(categoryId: IndexerSourceCategoryID, page: number): string
  getCookies(): { [name: string]: string }
  getDownloadUrl(assetId: AssetID, variant?: string): string
  getEntries(html: HTMLElement): IndexerBaseEntry[]
  getEntryDetails(assetId: AssetID, html: HTMLElement): IndexerEntryDetails
  getVariants(html: HTMLElement): { [variant: string]: string }
  id: IndexerSourceID
}

export interface IndexerSourceCategory {
  /** Default manager categories, comma-separated */
  category: string
  id: IndexerSourceCategoryID
}

export type IndexerSourceCategoryID = ID<IndexerSourceCategory>

export type IndexerCategoryID = `${IndexerSourceID}/${IndexerSourceCategoryID}`

export interface IndexerPathOverride {
  packageId?: PackageID
  variantId?: VariantID
}

export interface IndexerVariantOverride extends IndexerPathOverride {
  paths?: {
    [path in string]: IndexerPathOverride | null
  }
}

export interface IndexerOverride extends IndexerVariantOverride {
  superseded?: AssetID
  variants?: {
    [variant in string]?: IndexerVariantOverride | null
  }
}

export type IndexerOverrides = {
  [assetId in AssetID]?: IndexerOverride | null
}
