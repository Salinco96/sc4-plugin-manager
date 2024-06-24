import { isDefined } from "./types"

export function difference<T>(array: ReadonlyArray<T>, values: ReadonlyArray<T>): T[] {
  return array.filter(v => !values.includes(v))
}

export function hasAny<T>(array: ReadonlyArray<T>, values: ReadonlyArray<T>): boolean {
  return array.some(v => values.includes(v))
}

export function mapDefined<T, R = T>(
  iterable: Iterable<T>,
  fn: (value: T, index: number, array: ReadonlyArray<T>) => R | undefined,
): R[] {
  return Array.from(iterable).map(fn).filter(isDefined)
}

export function removeElement<T>(array: ReadonlyArray<T>, value: T): T[] {
  return array.filter(v => v !== value)
}

export function toggleElement<T>(array: ReadonlyArray<T>, value: T): T[] {
  return array.includes(value) ? array.filter(v => v !== value) : [...array, value]
}

export function removeElement$<T>(array: T[], element: T): boolean {
  const index = array.indexOf(element)
  if (index >= 0) {
    array.splice(index, 1)
    return true
  } else {
    return false
  }
}
