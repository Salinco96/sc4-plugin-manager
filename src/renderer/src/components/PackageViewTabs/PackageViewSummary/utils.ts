import type { EditableVariantInfo } from "@common/variants"
import { isEmpty } from "@salinco/nice-utils"

const VERSION_REGEX = /^([1-9][0-9]*|0)([.]([1-9][0-9]*|0)){2}/g

export function getErrors(
  data: EditableVariantInfo,
): Partial<Record<keyof EditableVariantInfo, string>> | undefined {
  const errors: Partial<Record<keyof EditableVariantInfo, string>> = {}

  if (!data.version) {
    errors.version = "Required"
  } else if (!data.version.match(VERSION_REGEX)) {
    errors.version = "Invalid version format: expected x.y.z"
  }

  return isEmpty(errors) ? undefined : errors
}

export function getFinalData(data: EditableVariantInfo): {
  [K in keyof Required<EditableVariantInfo>]: EditableVariantInfo[K]
} {
  return {
    authors: data.authors,
    categories: data.categories,
    credits: data.credits?.filter(credit => credit.id || credit.text),
    deprecated: data.deprecated,
    description: data.description,
    experimental: data.experimental,
    name: data.name,
    repository: data.repository,
    summary: data.summary,
    support: data.support,
    url: data.url,
    thanks: data.thanks?.filter(credit => credit.id || credit.text),
    version: data.version,
  }
}
