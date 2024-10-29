import { Namespace, TFunction } from "i18next"

import { AuthorID, Authors } from "@common/authors"
import { Categories, CategoryID, getCategoryLabel } from "@common/categories"
import { PackageState } from "@common/types"
import { isEnum } from "@common/utils/types"
import { getStateLabel } from "@common/variants"

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
  [TagType.STATE]: PackageState
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
  [state in PackageState]: "error" | "info" | "success" | "warning" | null
} = {
  [PackageState.ENABLED]: "success",
  [PackageState.DEPENDENCY]: "success",
  [PackageState.DEPRECATED]: "warning",
  [PackageState.DISABLED]: "error",
  [PackageState.ERROR]: "error",
  [PackageState.EXPERIMENTAL]: "warning",
  [PackageState.INCOMPATIBLE]: null,
  [PackageState.INCLUDED]: null,
  [PackageState.INSTALLED]: null,
  [PackageState.LOCAL]: "warning",
  [PackageState.NEW]: "info",
  [PackageState.OUTDATED]: "warning",
  [PackageState.PATCHED]: "warning",
}
