import { sortBy } from "@salinco/nice-utils"

export function prioritize<T>(items: readonly T[], fn: (item: T) => boolean | number): T[] {
  return sortBy(items, item => Number(fn(item)))
}
