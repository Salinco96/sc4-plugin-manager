import type { Primitive } from "@common/types"

import { isArray, isDefined } from "./types"

export function difference<T>(array: ReadonlyArray<T>, values: ReadonlyArray<T>): T[] {
  return array.filter(v => !values.includes(v))
}

export function hasAll<T>(array: ReadonlyArray<T>, values: ReadonlyArray<T>): boolean {
  return array.every(v => values.includes(v))
}

export function hasAny<T>(array: ReadonlyArray<T>, values: ReadonlyArray<T>): boolean {
  return array.some(v => values.includes(v))
}

export function toArray<T>(iterable: Iterable<T>): T[] {
  return Array.isArray(iterable) ? iterable : Array.from(iterable)
}

export function where<T extends Partial<S>, S extends Partial<T> = Partial<T>>(
  condition: T,
): (value: S) => boolean {
  return (value: S) => {
    for (const key in condition) {
      if ((value as Partial<T>)[key] !== condition[key]) {
        return false
      }
    }

    return true
  }
}

export function containsWhere<T extends Partial<S>, S extends Partial<T> = Partial<T>>(
  array: ReadonlyArray<T>,
  condition: S,
): boolean {
  return array.some(where<S, T>(condition))
}

export async function filterAsync<T>(
  iterable: Iterable<T>,
  fn: (value: T) => Promise<boolean>,
): Promise<T[]> {
  const result: T[] = []

  for (const value of iterable) {
    if (await fn(value)) {
      result.push(value)
    }
  }

  return result
}

export function map<T, R = T>(
  iterable: Iterable<T>,
  fn: (value: T, index: number, array: ReadonlyArray<T>) => R,
): R[] {
  return toArray(iterable).map(fn)
}

export function sumBy<T>(iterable: Iterable<T>, fn: (value: T) => number): number {
  return toArray(iterable).reduce((total, value) => total + fn(value), 0)
}

export function sum(iterable: Iterable<number>): number {
  return toArray(iterable).reduce((total, value) => total + value, 0)
}

export function flatMap<T, R = T>(
  iterable: Iterable<T>,
  fn: (value: T, index: number, array: ReadonlyArray<T>) => R[],
): R[] {
  return toArray(iterable).flatMap(fn)
}

export function mapDefined<T, R = T>(
  iterable: Iterable<T>,
  fn: (value: T, index: number, array: ReadonlyArray<T>) => R | undefined,
): R[] {
  return toArray(iterable).map(fn).filter(isDefined)
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
  }

  return false
}

export function concat<T>(array: ReadonlyArray<T>, other: ReadonlyArray<T>): T[] {
  return array.concat(other)
}

export function union<T>(array: ReadonlyArray<T>, other: ReadonlyArray<T>): T[] {
  return unique(array.concat(other))
}

export function unionBy<T, S extends number | string>(
  array: ReadonlyArray<T>,
  other: ReadonlyArray<T>,
  fn: (value: T) => S,
): T[] {
  return uniqueBy(array.concat(other), fn)
}

export function potentialUnion<T>(
  array: ReadonlyArray<T> | undefined,
  other: ReadonlyArray<T> | undefined,
): T[] | undefined {
  return (array || other) && union(array ?? [], other ?? [])
}

export function potentialUnionBy<T, S extends number | string>(
  array: ReadonlyArray<T> | undefined,
  other: ReadonlyArray<T> | undefined,
  fn: (value: T) => S,
): T[] | undefined {
  return (array || other) && unionBy(array ?? [], other ?? [], fn)
}

export function unique<T>(array: ReadonlyArray<T>): T[] {
  return Array.from(new Set(array))
}

export function uniqueBy<T, S extends number | string>(
  array: ReadonlyArray<T>,
  fn: (value: T) => S,
): T[] {
  return Object.values(
    array.reduce(
      (record, value) => {
        record[fn(value)] ??= value
        return record
      },
      {} as Record<S, T>,
    ),
  )
}

export function isEqual(a: Primitive | Primitive[], b: Primitive | Primitive[]): boolean {
  return isArray(a) ? isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]) : a === b
}

export function replaceAt<T>(array: ReadonlyArray<T>, index: number, value: T): T[] {
  return [...array.slice(0, index), value, ...array.slice(index + 1)]
}

export function removeAt<T>(array: ReadonlyArray<T>, index: number, count = 1): T[] {
  return [...array.slice(0, index), ...array.slice(index + count)]
}

export function splice<T>(
  array: ReadonlyArray<T>,
  index: number,
  deleteCount: number,
  ...values: T[]
): T[] {
  return [...array.slice(0, index), ...values, ...array.slice(index + deleteCount)]
}

export function fill<T>(length: number, fn: (index: number) => T): T[] {
  return Array.from({ length }, (value, index) => fn(index))
}

export function pad<T>(array: T[], length: number, value: T): T[] {
  if (array.length < length) {
    return fill(length, index => array.at(index) ?? value)
  }

  return array
}

export function groupBy<T, K extends number | string>(
  items: T[],
  fn: (value: T, index: number) => K | null,
): Partial<Record<K, T[]>> {
  return items.reduce(
    (result, value, index) => {
      const key = fn(value, index)
      if (key !== null) {
        result[key] ??= []
        result[key].push(value)
      }
      return result
    },
    {} as Record<K, T[]>,
  )
}

export function indexBy<T, K extends number | string>(
  items: T[],
  fn: (value: T, index: number) => K,
): Partial<Record<K, T>> {
  return items.reduce(
    (result, value, index) => {
      const key = fn(value, index)
      result[key] = value
      return result
    },
    {} as Record<K, T>,
  )
}

export function splitBy<T>(items: T[], fn: (value: T, index: number) => boolean): [T[], T[]] {
  const others: T[] = []
  return [
    items.filter((value, index) => {
      if (fn(value, index)) {
        return true
      }

      others.push(value)
    }),
    others,
  ]
}
