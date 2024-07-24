import { HTMLElement } from "node-html-parser"

export interface IndexerOptions {
  exclude?: string[]
  fetchEntryDetails?: boolean
  fetchNewEntries?: boolean
  include: (entry: IndexerBaseEntry, entryId: string) => boolean
  overrides?: IndexerOverrides
  sources: IndexerSource[]
  superseded?: { [entryId: string]: string }
}

export interface IndexerOverrides {
  [entryId: string]: null | {
    downloadUrl?: string
    packageId?: string
    variantId?: string
    variants?: {
      [variant: string]: null | {
        packageId?: string
        variantId?: string
      }
    }
  }
}

export interface IndexerBaseEntry {
  authors: string[]
  downloads?: number
  lastModified: string
  name: string
  thumbnail?: string
  url: string
}

export interface IndexerVariantEntry {
  filename?: string
  files?: string[]
  sha256?: string
  size?: number
  uncompressed?: number
}

export interface IndexerEntryDetails {
  dependencies?: string[]
  description?: string
  images?: string[]
  repository?: string
  version?: string
}

export interface IndexerEntry extends IndexerBaseEntry, IndexerEntryDetails, IndexerVariantEntry {
  category: number
  timestamp?: string
  variants?: { [variant: string]: IndexerVariantEntry }
}

export interface IndexerEntryList {
  assets: { [assetId: string]: IndexerEntry }
  timestamp?: string
}

export interface IndexerCategory {
  category: number
  id: string
}

export interface IndexerSource {
  categories: IndexerCategory[]
  getCategoryPageCount(html: HTMLElement): number
  getCategoryUrl(categoryId: string, page: number): string
  getCookies(): { [name: string]: string }
  getDownloadUrl(entryId: string, variant?: string): string
  getEntries(html: HTMLElement): [entryId: string, entry: IndexerBaseEntry][]
  getEntryDetails(entryId: string, html: HTMLElement): IndexerEntryDetails
  getVariants(html: HTMLElement): { [variant: string]: string }
  id: string
}
