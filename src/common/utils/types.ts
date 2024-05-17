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

/**
 * Checks that a value is an array.
 * @param value Value to check
 * @returns whether the value is an array
 */
export function isArray(value: unknown): value is unknown[] {
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
): value is T[] {
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
