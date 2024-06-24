export function entries<K extends string, T>(object: Readonly<Partial<Record<K, T>>>): [K, T][] {
  return Object.entries(object) as [K, T][]
}

export function filterValues<K extends string, T>(
  object: Readonly<Record<K, T>>,
  fn: (value: T, key: K) => boolean,
): Partial<Record<K, T>> {
  return Object.fromEntries(
    Object.entries(object).filter(([key, value]) => fn(value as T, key as K)),
  ) as Partial<Record<K, T>>
}

export function keys<K extends string>(object: Readonly<Partial<Record<K, unknown>>>): K[] {
  return Object.keys(object) as K[]
}

export function mapValues<K extends string, T, R = T>(
  object: Readonly<Record<K, T>>,
  fn: (value: T, key: K) => R,
): Record<K, R> {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [key, fn(value as T, key as K)]),
  ) as Record<K, R>
}

export function compact<K extends string, T>(
  object: Readonly<Record<K, T | null | undefined>>,
): Record<K, Exclude<T, null | undefined>> {
  return filterValues(object, value => value != null) as Record<K, Exclude<T, null | undefined>>
}
