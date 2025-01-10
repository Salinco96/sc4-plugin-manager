export function split<T extends `${string}${S}${string}${S}${string}`, S extends string>(
  value: T,
  separator: S,
): T extends `${infer A extends string}${S}${infer B extends string}${S}${infer C extends string}`
  ? [A, B, C]
  : string[]

export function split<T extends `${string}${S}${string}`, S extends string>(
  value: T,
  separator: S,
): T extends `${infer A extends string}${S}${infer B extends string}` ? [A, B] : string[]

export function split(value: string, separator: string): string[]

export function split(value: string, separator: string) {
  return value.split(separator)
}
