import { isArray } from "@salinco/nice-utils"

export type MaybeArray<T> = T | T[]

/**
 * Removes common diacritics from a string and converts it to lower case.
 */
export function normalizeString(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      // biome-ignore lint/suspicious/noMisleadingCharacterClass: <explanation>
      .replace(/[\u0300-\u036f]/g, "")
  )
}

// TODO: Move to nice-utils
export function parseStringArray(value: MaybeArray<string>, separator = ","): string[] {
  return isArray(value) ? value : value.split(separator).map(trim)
}

// TODO: Move to nice-utils
export function trim(value: string): string {
  return value.trim()
}
