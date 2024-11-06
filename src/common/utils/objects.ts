import { isArray } from "./types"

export function entries<K extends string, T>(object: Readonly<Partial<Record<K, T>>>): [K, T][] {
  return Object.entries(object) as [K, T][]
}

export function forEach<K extends string, T>(
  object: Readonly<Partial<Record<K, T>>>,
  fn: (value: T, key: K) => void,
): void {
  for (const key in object) {
    const value = object[key]
    if (value !== undefined) {
      fn(value, key)
    }
  }
}

export function reduce<K extends string, T, R>(
  object: Readonly<Partial<Record<K, T>>>,
  fn: (result: R, value: T, key: K) => R,
  initialValue: R,
): R {
  let result = initialValue

  for (const key in object) {
    const value = object[key]
    if (value !== undefined) {
      result = fn(result, value, key)
    }
  }

  return result
}

export async function reduceAsync<K extends string, T, R>(
  object: Readonly<Partial<Record<K, T>>>,
  fn: (result: R, value: T, key: K) => Promise<R>,
  initialValue: R,
): Promise<R> {
  let result = initialValue

  for (const key in object) {
    const value = object[key]
    if (value !== undefined) {
      result = await fn(result, value, key)
    }
  }

  return result
}

export async function forEachAsync<K extends string, T>(
  object: Readonly<Partial<Record<K, T>>>,
  fn: (value: T, key: K) => Promise<void>,
): Promise<void> {
  for (const key in object) {
    const value = object[key]
    if (value !== undefined) {
      await fn(value, key)
    }
  }
}

export function values<T>(object: Readonly<Partial<Record<string, T>>>): T[] {
  return Object.values(object) as T[]
}

export function filterValues<K extends string, T>(
  object: Readonly<Partial<Record<K, T>>>,
  fn: (value: T, key: K) => boolean,
): Partial<Record<K, T>> {
  return Object.fromEntries(
    Object.entries(object).filter(([key, value]) => fn(value as T, key as K)),
  ) as Partial<Record<K, T>>
}

export function findKeys<K extends string, T>(
  object: Readonly<Record<K, T>>,
  fn: (value: T, key: K) => boolean,
): K[] {
  return keys(object).filter(key => fn(object[key], key))
}

export function keys<K extends string>(object: Readonly<Partial<Record<K, unknown>>>): K[] {
  return Object.keys(object) as K[]
}

export function size(
  object: ReadonlyArray<unknown> | Readonly<Partial<Record<string, unknown>>>,
): number {
  return (isArray(object) ? object : Object.keys(object)).length
}

export function isEmpty(
  object: ReadonlyArray<unknown> | Readonly<Partial<Record<string, unknown>>>,
): boolean {
  return size(object) === 0
}

export function mapKeys<K extends string, T, R extends number | string = K>(
  object: Readonly<Partial<Record<K, T>>>,
  fn: (key: K, value: T) => R,
): Partial<Record<R, T>> {
  return Object.fromEntries(
    entries(object).map(([key, value]) => [fn(key, value), value]),
  ) as Partial<Record<R, T>>
}

export function mapValues<K extends string, T, R = T>(
  object: Readonly<Partial<Record<K, T>>>,
  fn: (value: T, key: K) => R,
): Partial<Record<K, R>> {
  return Object.fromEntries(
    entries(object).map(([key, value]) => [key, fn(value, key)]),
  ) as Partial<Record<K, R>>
}

export function compact<K extends string, T>(
  object: Readonly<Record<K, T | null | undefined>>,
): Record<K, Exclude<T, null | undefined>> {
  return filterValues(object, value => value != null) as Record<K, Exclude<T, null | undefined>>
}
