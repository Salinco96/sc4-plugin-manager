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

export function isDefined<T>(value: T): value is Exclude<T, undefined> {
  return value !== undefined
}

export function ifUndefined<T, R = T>(
  value: T | undefined,
  fn: () => R,
): Exclude<T, undefined> | R {
  return isDefined(value) ? value : fn()
}

/**
 * Checks that a value is an array.
 * @param value Value to check
 * @returns whether the value is an array
 */
export function isArray(value: unknown): value is ReadonlyArray<unknown> {
  return Array.isArray(value)
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
 * Checks that a value is a boolean.
 * @param value Value to check
 * @returns whether the value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return value === true || value === false
}

/**
 * Checks that a value is a string representing a valid date.
 * @param value Value to check
 * @returns whether the value is a string representing a valid {@link Date}
 */
export function isDateString(value: unknown): value is string {
  return typeof value === "string" && !isNaN(new Date(value).getTime())
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
 * Checks that a value is a finite number.
 * @param value Value to check
 * @returns whether the value is a finite number
 */
export function isNumber(value: unknown): value is number {
  return Number.isFinite(value)
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
 * Checks that a value is a string.
 * @param value Value to check
 * @returns whether the value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === "string"
}

/**
 * Removes common diacritics from a string and converts it to lower case.
 */
export function normalizeString(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
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
