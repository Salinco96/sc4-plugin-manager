import { Primitive } from "@common/types"
import { mapValues } from "@common/utils/objects"
import { isBoolean, isNumber, isObject, isString } from "@common/utils/types"
import { failInDev } from "@utils/env"

function failLoading<T, Required extends boolean = false>(
  value: unknown,
  expected: string,
  id: string,
  field: string,
  required?: Required,
): Required extends true ? T : T | undefined {
  if (value !== undefined) {
    const received = JSON.stringify(value)
    failInDev(`Error loading ${id} - invalid ${field}: ${expected} but got ${received}`)
  } else if (required) {
    failInDev(`Error loading ${id} - missing ${field}`)
  }

  return undefined as Required extends true ? T : T | undefined
}

export function loadArray<T, Required extends boolean = false>(
  value: Primitive | T[],
  id: string,
  field: string,
  required?: Required,
): Required extends true ? T[] : T[] | undefined {
  if (Array.isArray(value)) {
    return value
  }

  return failLoading(value, "array", id, field, required)
}

export function loadBoolean<Required extends boolean = false>(
  value: Primitive | unknown[],
  id: string,
  field: string,
  required?: Required,
): Required extends true ? boolean : boolean | undefined {
  if (isBoolean(value)) {
    return value
  }

  return failLoading(value, "boolean", id, field, required)
}

export function loadDate<Required extends boolean = false>(
  value: Primitive | unknown[],
  id: string,
  field: string,
  required?: Required,
): Required extends true ? string : string | undefined {
  if (isNumber(value) || isString(value)) {
    return new Date(value).toISOString()
  }

  return failLoading(value, "date", id, field, required)
}

export function loadEnumArray<E extends Primitive, Required extends boolean = false>(
  value: Primitive | unknown[],
  values: E[],
  id: string,
  field: string,
  required?: Required,
): Required extends true ? E[] : E[] | undefined {
  if (Array.isArray(value) && value.every(item => value.includes(item as E))) {
    return value as E[]
  }

  return failLoading(value, "array of " + JSON.stringify(values), id, field, required)
}

export function loadEnum<E extends Primitive, Required extends boolean = false>(
  value: Primitive | unknown[],
  values: E[],
  id: string,
  field: string,
  required?: Required,
): Required extends true ? E : E | undefined {
  if (values.includes(value as E)) {
    return value as E
  }

  return failLoading(value, JSON.stringify(values), id, field, required)
}

export function loadInteger<Required extends boolean = false>(
  value: Primitive | unknown[],
  id: string,
  field: string,
  required?: Required,
): Required extends true ? number : number | undefined {
  if (isString(value)) {
    return Number.parseInt(value, 10)
  }

  if (isNumber(value)) {
    return Math.floor(value)
  }

  return failLoading(value, "integer", id, field, required)
}

export function loadRecord<T, Required extends boolean = false>(
  value: unknown,
  expected: string,
  condition: (value: unknown) => value is T,
  id: string,
  field: string,
  required?: Required,
): Required extends true ? { [K in string]?: T } : { [K in string]?: T } | undefined {
  if (isObject(value)) {
    return mapValues(value, (optionValue, optionId) => {
      return loadValue(optionValue, expected, condition, id, field + "." + optionId, true)
    })
  }

  return failLoading(value, "record of " + expected, id, field, required)
}

export function loadValue<T, Required extends boolean = false>(
  value: unknown,
  expected: string,
  condition: (value: unknown) => value is T,
  id: string,
  field: string,
  required?: Required,
): Required extends true ? T : T | undefined {
  if (condition(value)) {
    return value
  }

  return failLoading(value, expected, id, field, required)
}

export function loadString<Required extends boolean = false>(
  value: Primitive | unknown[],
  id: string,
  field: string,
  required?: Required,
): Required extends true ? string : string | undefined {
  if (isString(value)) {
    return value
  }

  if (isNumber(value)) {
    return value.toString(10)
  }

  return failLoading(value, "string", id, field, required)
}
