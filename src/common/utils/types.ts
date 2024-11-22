import { isDefined } from "@salinco/nice-utils"

/**
 * Asserts that a condition is satisfied.
 * @param condition Condition
 * @param message Error message
 * @throws if {@link condition} is `false`
 */
export function assert(condition: boolean, message?: string): asserts condition {
  if (!condition) {
    throw Error(message ?? "Assertion failed")
  }
}

export function ifDefined<T, R = T>(
  value: T | undefined,
  fn: (value: Exclude<T, undefined>) => R,
): R | undefined {
  return isDefined(value) ? fn(value) : undefined
}

export function ifUndefined<T, R = T>(
  value: T | undefined,
  fn: () => R,
): Exclude<T, undefined> | R {
  return isDefined(value) ? value : fn()
}

/**
 * Checks that a value is an array of a given type.
 * @param value Value to check
 * @param itemPredicate Item type predicate
 * @returns whether the value is an array containing only elements of the given type
 */
export function isArrayOf<T>(
  value: unknown,
  itemPredicate: (value: unknown) => value is T,
): value is ReadonlyArray<T> {
  return Array.isArray(value) && value.every(itemPredicate)
}

/**
 * Checks that a value is a string enum member.
 * @param value Value to check
 * @param members TS string enum
 * @returns whether the value is a member of the given string enum
 */
export function isEnum<E extends string>(value: unknown, members: Record<string, E>): value is E {
  return Object.values(members).includes(value as E)
}

/**
 * Checks that a value is a string enum member.
 * @param value Value to check
 * @param members TS string enum
 * @returns whether the value is a member of the given string enum
 */
export function isOneOf<E extends string>(value: unknown, values: ReadonlyArray<E>): value is E {
  return values.includes(value as E)
}

/**
 * Checks that a value is an object.
 * @param value Value to check
 * @returns whether the value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

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

export function pick<T extends object, K extends keyof T>(object: T, keys: K[]): Pick<T, K>
export function pick<T extends object>(object: T, keys: (keyof T)[]): Partial<T>
export function pick<T extends object>(object: T, keys: (keyof T)[]): Partial<T> {
  const result: Partial<T> = {}

  for (const key of keys) {
    result[key] = object[key]
  }

  return result
}
