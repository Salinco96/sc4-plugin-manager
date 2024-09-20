import { AuthorID, Authors } from "@common/authors"
import { CategoryID, getCategoryLabel } from "@common/categories"
import { t } from "@common/i18n"
import { PackageState } from "@common/types"
import { isEnum } from "@common/utils/types"
import { getStateLabel } from "@common/variants"

export type Tag<T extends TagType = TagType> = {
  [K in T]: {
    type: K
    value: TagValue<K>
  }
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

export function deserializeTag(tag: string): Tag {
  const [type, value] = tag.split(":", 2)
  return { type, value } as Tag
}

export function getLongTagLabel(tag: Tag, authors: Authors): string {
  return t(tag.type, { label: getTagLabel(tag, authors), ns: "PackageTag" })
}

export function getTagLabel(tag: Tag, authors: Authors): string {
  switch (tag.type) {
    case TagType.AUTHOR:
      return getAuthorName(tag.value, authors)

    case TagType.CATEGORY:
      return getCategoryLabel(tag.value)

    case TagType.STATE:
      return getStateLabel(tag.value)
  }
}

export function isValidTag(tag: string): boolean {
  const [type] = tag.split(":", 2)
  return isEnum(type, TagType)
}

export function createTag<T extends TagType>(type: T, value: TagValue<T>): Tag<T> {
  return { type, value }
}

export function serializeTag<T extends TagType>(type: T, value: TagValue<T>): string {
  return `${type}:${value}`
}
