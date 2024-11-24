import { type Primitive, isArray } from "@salinco/nice-utils"

export function isEqual(a: Primitive | Primitive[], b: Primitive | Primitive[]): boolean {
  return isArray(a) ? isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]) : a === b
}
