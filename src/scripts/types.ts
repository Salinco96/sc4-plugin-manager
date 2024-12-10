import type { ID } from "@salinco/nice-utils"
import type { HTMLElement } from "node-html-parser"

import type { AssetID } from "@common/assets"
import type { CategoryID } from "@common/categories"
import type { PackageID } from "@common/packages"
import type { MaybeArray } from "@common/utils/types"

import type { SC4FileData } from "./dbpf/dbpf"

export interface IndexerOptions {
  include: {
    authors: string[]
    date: Date
    entries: string[]
  }
  migrate?: {
    entries?: (entry: IndexerEntry, entryId: EntryID) => void
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
  authors?: string[]
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
  support?: string
  version?: string
}

export interface IndexerVariantEntry extends Partial<SC4FileData> {
  download?: string
  filename?: string
  files?: string[]
  /** Download hash */
  sha256?: string
  /** Download size in bytes */
  size?: number
  /** Uncompressed size in bytes, if download is compressed */
  uncompressed?: number
}

export interface IndexerEntry extends IndexerBaseEntry, IndexerEntryDetails, IndexerVariantEntry {
  /** Category ID within the source (e.g. "101-residential" in Simtropolis) */
  category?: IndexerCategoryID
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

export type IndexerSourceID = ID<string, IndexerSource>

export interface IndexerSource {
  categories: { [id in IndexerCategoryID]?: IndexerCategory }
  getCategoryPageCount(html: HTMLElement): number
  getCategoryUrl(categoryId: IndexerCategoryID, page: number): string
  getCookies(): { [name: string]: string }
  getDownloadUrl(assetId: AssetID, variant?: string): string
  getEntries(html: HTMLElement): IndexerBaseEntry[]
  getEntryDetails(html: HTMLElement): IndexerEntryDetails
  getVariants(html: HTMLElement): { [variant: string]: string }
  id: IndexerSourceID
}

export interface IndexerCategory {
  /** Default manager categories, comma-separated */
  categories?: CategoryID[]
  id: IndexerCategoryID
}

export type IndexerCategoryID = ID<string, IndexerCategory>

export interface IndexerPathOverride {
  override?: boolean
  packageId?: PackageID
  variantId?: MaybeArray<string>
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
