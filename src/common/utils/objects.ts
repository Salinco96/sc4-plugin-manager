import { type Defined, keys } from "@salinco/nice-utils"

// TODO: Move to utils
export function findKeys<T, K extends string>(
  object: Partial<Record<K, T>>,
  fn: (value: Defined<T>, key: K) => boolean | null | undefined,
): K[] {
  return keys(object).filter(key => fn(object[key] as Defined<T>, key))
}
