import { isEnum } from "@common/utils/types"

export interface Tag {
  type?: TagType
  value: string
}

export enum TagType {
  AUTHOR = "author",
  CATEGORY = "category",
}

export function capitalize(text: string): string {
  return text.replace(/^\w/, c => c.toUpperCase())
}

export function createTags(type: TagType, values: string[]): string[] {
  return values.map(value => `${type}:${value}`)
}

export function getTagLabel(tag: string, long?: boolean): string {
  const { type, value } = parseTag(tag)
  const label = type === TagType.CATEGORY ? capitalize(value) : value
  return type && long ? `${capitalize(type)}: ${label}` : label
}

export function parseTag(tag: string): Tag {
  const [type, value] = tag.split(":", 2)
  return isEnum(type, TagType) ? { type, value } : { value: tag }
}
