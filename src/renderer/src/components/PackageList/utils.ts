import { getCategoryLabel, getStateLabel } from "@common/categories"
import { t } from "@common/i18n"
import { PackageState } from "@common/types"
import { isEnum } from "@common/utils/types"

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
  [TagType.AUTHOR]: string
  [TagType.CATEGORY]: string
  [TagType.STATE]: PackageState
}[T]

export function deserializeTag(tag: string): Tag {
  const [type, value] = tag.split(":", 2)
  return { type, value } as Tag
}

export function getLongTagLabel(tag: Tag): string {
  return t(tag.type, { label: getTagLabel(tag), ns: "PackageTag" })
}

export function getTagLabel(tag: Tag): string {
  switch (tag.type) {
    case TagType.AUTHOR:
      return tag.value

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

export function serializeTag<T extends TagType>(type: T, value: TagValue<T>): string {
  return `${type}:${value}`
}
