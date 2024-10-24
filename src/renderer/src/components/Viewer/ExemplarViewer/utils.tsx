import {
  ExemplarData,
  ExemplarDataPatch,
  ExemplarProperty,
  ExemplarValueType,
} from "@common/exemplars"
import { isEqual } from "@common/utils/arrays"
import { toHex } from "@common/utils/hex"
import { forEach } from "@common/utils/objects"
import { isArray, isBoolean, isNumber, isString } from "@common/utils/types"

import { InputProps } from "./ExemplarPropertyInput"

export function getDiff(
  currentData: ExemplarData,
  originalData: ExemplarData,
): ExemplarDataPatch | null {
  if (currentData === originalData) {
    return null
  }

  let diff: ExemplarDataPatch | null = null

  if (currentData.parentCohortId !== originalData.parentCohortId) {
    diff ??= {}
    diff.parentCohortId = currentData.parentCohortId
  }

  for (const propertyId in originalData.properties) {
    const currentValue = currentData.properties[propertyId]?.value ?? null
    const originalValue = originalData.properties[propertyId]?.value ?? null
    if (!isEqual(currentValue, originalValue)) {
      diff ??= {}
      diff.properties ??= {}
      diff.properties[toHex(Number(propertyId), 8)] = currentValue
    }
  }

  return diff
}

export type PropertyErrors = string | (string | undefined)[]

export interface ExemplarErrors {
  parentCohortId?: PropertyErrors
  properties?: {
    [propertyId in number]?: PropertyErrors
  }
}

export function getErrors(data: ExemplarData): ExemplarErrors | undefined {
  let errors: ExemplarErrors | undefined

  forEach(data.properties, property => {
    const propertyErrors = getPropertyErrors(property)
    if (propertyErrors) {
      errors ??= {}
      errors.properties ??= {}
      errors.properties[property.id] = propertyErrors
    }
  })

  return errors
}

function getPropertyErrors(property: ExemplarProperty): PropertyErrors | undefined {
  const { info, type, value } = property
  const maxLength = info?.maxLength ?? 64
  const minLength = info?.minLength ?? 1

  if (type === ExemplarValueType.String) {
    if (!isString(value)) {
      return "Mismatching type"
    }

    if (info?.size && value.length !== info.size) {
      return `Must contain ${minLength} character(s)`
    }

    if (value.length < minLength) {
      return `Min ${minLength} character(s)`
    }

    if (value.length > maxLength) {
      return `Max ${maxLength} character(s)`
    }

    return undefined
  }

  if (info?.size === 0 && isArray(value)) {
    return "Mismatching type"
  }

  const values = isArray(value) ? value : [value]

  if (info?.size && values.length !== info.size) {
    return `Must contain ${minLength} item(s)`
  }

  if (values.length < minLength) {
    return `Min ${minLength} item(s)`
  }

  if (values.length > maxLength) {
    return `Max ${maxLength} item(s)`
  }

  const errors = values.map((item, index) => {
    if (type === ExemplarValueType.Bool) {
      if (!isBoolean(item)) {
        return "Mismatching type"
      }

      return undefined
    }

    if (!isNumber(item)) {
      return "Mismatching type"
    }

    const itemInfo = info?.items?.at(index)
    const max = itemInfo?.max ?? info?.max ?? InputProps[type].max
    const min = itemInfo?.min ?? info?.min ?? InputProps[type].min

    if (info?.strict && info.choices && !info.choices.some(choice => choice.value === item)) {
      return "Unsupported value"
    }

    if (min !== undefined && item < min) {
      return `Min ${min}`
    }

    if (max !== undefined && item > max) {
      return `Max ${max}`
    }

    return undefined
  })

  return errors.some(isString) ? errors : undefined
}

export function getHexSize(type: ExemplarValueType): number {
  switch (type) {
    case ExemplarValueType.UInt8:
      return 2
    case ExemplarValueType.UInt16:
      return 4
    case ExemplarValueType.SInt64:
      return 16
    default:
      return 8
  }
}

export function getMax(type: ExemplarValueType): number | undefined {
  switch (type) {
    case ExemplarValueType.UInt8:
      return 0xff
    case ExemplarValueType.UInt16:
      return 0xffff
  }
}

export function getMin(type: ExemplarValueType): number | undefined {
  switch (type) {
    case ExemplarValueType.UInt8:
    case ExemplarValueType.UInt16:
    case ExemplarValueType.UInt32:
      return 0
  }
}

export function getStep(type: ExemplarValueType): number | undefined {
  switch (type) {
    case ExemplarValueType.UInt8:
    case ExemplarValueType.UInt16:
    case ExemplarValueType.UInt32:
    case ExemplarValueType.SInt32:
    case ExemplarValueType.SInt64:
      return 1
  }
}

export function formatInputValue(
  value: number | string | boolean,
  type: ExemplarValueType,
  isHex: boolean,
): string {
  if (isString(value)) {
    return value
  }

  if (isBoolean(value)) {
    return value ? "Yes" : "No"
  }

  if (isHex) {
    return toHex(value, getHexSize(type), false, true)
  }

  if (type === ExemplarValueType.Float32) {
    return Number.parseFloat(value.toFixed(8)).toString(10)
  }

  return value.toFixed(0)
}

export function parseInputValue(
  value: string,
  type: ExemplarValueType,
  isHex: boolean,
  oldValue: string,
): [inputValue: string, parsedValue: number | string | boolean | null] {
  if (type === ExemplarValueType.String) {
    return [value, value]
  }

  if (type === ExemplarValueType.Bool) {
    const match = value.match(/^[0-1]/)
    return match ? [match[0], match[0] === "1"] : ["", null]
  }

  if (isHex) {
    const hexSize = getHexSize(type)
    const match = value.match(new RegExp(`^[0-9a-f]{1,${hexSize + 1}}`, "i"))
    if (!match) {
      return ["", null]
    }

    let newValue = match[0]
    if (newValue.length > hexSize) {
      if (oldValue.startsWith("0") && newValue.startsWith(oldValue)) {
        newValue = newValue.slice(1)
      } else {
        newValue = newValue.slice(0, hexSize)
      }
    }

    return [newValue, Number.parseInt(newValue, 16)]
  }

  if (type === ExemplarValueType.Float32) {
    const match = value.match(/^-?[0-9]+[.]?[0-9]{0,8}([e][0-9]{0,2})?/)
    return match ? [match[0], Number.parseFloat(match[0])] : ["", null]
  }

  const match = value.match(/^-?[0-9]+([e][0-9]{0,2})?/)
  return match ? [match[0], Number.parseInt(match[0], 10)] : ["", null]
}
