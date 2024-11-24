import type { Namespace, TFunction } from "i18next"

import type { AuthorID, Authors } from "@common/authors"
import { type Categories, type CategoryID, getCategoryLabel } from "@common/categories"
import { VariantState } from "@common/types"
import { getStateLabel } from "@common/variants"
import { isEnum } from "@salinco/nice-utils"

export type Tag<T extends TagType = TagType> = {
  [K in T]: {
    type: K
    value: TagValue<K>
  }
}[T]

export type SerializedTag<T extends TagType = TagType> = {
  [K in T]: `${K}:${TagValue<K>}`
}[T]

export enum TagType {
  AUTHOR = "author",
  CATEGORY = "category",
  STATE = "state",
}

export type TagValue<T extends TagType> = {
  [TagType.AUTHOR]: AuthorID
  [TagType.CATEGORY]: CategoryID
  [TagType.STATE]: VariantState
}[T]

export function getAuthorName(authorId: AuthorID, authors: Authors): string {
  return authors[authorId]?.name ?? authorId
}

export function deserializeTag<T extends TagType>(tag: SerializedTag<T>): Tag<T> {
  const [type, value] = tag.split(":", 2)
  return { type, value } as Tag<T>
}

export function getTagLongLabel(
  t: TFunction<Namespace>,
  tag: Tag,
  authors: Authors,
  categories: Categories,
): string {
  const label = getTagLabel(t, tag, authors, categories)
  return t(tag.type, { label, ns: "PackageTag" })
}

export function getTagLabel(
  t: TFunction<Namespace>,
  tag: Tag,
  authors: Authors,
  categories: Categories,
): string {
  switch (tag.type) {
    case TagType.AUTHOR:
      return getAuthorName(tag.value, authors)

    case TagType.CATEGORY:
      return getCategoryLabel(tag.value, categories)

    case TagType.STATE:
      return getStateLabel(t, tag.value)
  }
}

export function isValidTag(tag: string): tag is SerializedTag {
  const [type] = tag.split(":", 2)
  return isEnum(type, TagType)
}

export function createTag<T extends TagType>(type: T, value: TagValue<T>): Tag<T> {
  return { type, value }
}

export function serializeTag<T extends TagType>(type: T, value: TagValue<T>): SerializedTag<T> {
  return `${type}:${value}`
}

export const STATE_TAGS: {
  [state in VariantState]: "default" | "error" | "info" | "success" | "warning" | null
} = {
  [VariantState.DEFAULT]: null,
  [VariantState.ENABLED]: "success",
  [VariantState.DEPENDENCY]: "success",
  [VariantState.DEPRECATED]: "warning",
  [VariantState.DISABLED]: "error",
  [VariantState.ERROR]: "error",
  [VariantState.EXPERIMENTAL]: "warning",
  [VariantState.INCOMPATIBLE]: null,
  [VariantState.INCLUDED]: null,
  [VariantState.INSTALLED]: null,
  [VariantState.LOCAL]: "warning",
  [VariantState.NEW]: "info",
  [VariantState.OUTDATED]: "warning",
  [VariantState.PATCHED]: "warning",
  [VariantState.SELECTED]: "success",
}
