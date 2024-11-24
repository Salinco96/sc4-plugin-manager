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
