import {
  ExemplarData,
  ExemplarDataPatch,
  ExemplarProperty,
  ExemplarPropertyChoiceInfo,
  ExemplarPropertyItemInfo,
  ExemplarPropertyValue,
  ExemplarValueType,
} from "@common/exemplars"
import { isEqual } from "@common/utils/arrays"
import { toHex } from "@common/utils/hex"
import { forEach } from "@common/utils/objects"
import { isArray, isBoolean, isNumber, isString } from "@common/utils/types"

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

export function getItemInfo(
  property: ExemplarProperty,
  index: number,
): ExemplarPropertyItemInfo | undefined {
  const { info } = property

  return info?.items?.at(info?.size && info.repeat ? index % info.size : index)
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
  const minLength = info?.minLength ?? 0

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

  const values = isArray(value) ? value : [value]

  if (info?.size) {
    if (info.repeat) {
      if (values.length % info.size !== 0) {
        return `Must contain a multiple of ${minLength} items`
      }
    } else if (values.length !== info.size) {
      return `Must contain ${minLength} item(s)`
    }
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

    const max = getMax(property, index)
    const min = getMin(property, index)

    if (info?.strict && info.choices && !info.choices.some(choice => choice.value === item)) {
      return "Unsupported value"
    }

    if (min !== undefined && item < min) {
      return `Min ${formatSingleValue(min, property, index)}`
    }

    if (max !== undefined && item > max) {
      return `Max ${formatSingleValue(max, property, index)}`
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

export function getMax(property: ExemplarProperty, index: number): number | undefined {
  const { info, type } = property

  switch (type) {
    case ExemplarValueType.UInt8:
      return getItemInfo(property, index)?.max ?? info?.max ?? 0xff
    case ExemplarValueType.UInt16:
      return getItemInfo(property, index)?.max ?? info?.max ?? 0xffff
    default:
      return getItemInfo(property, index)?.max ?? info?.max
  }
}

export function getMin(property: ExemplarProperty, index: number): number | undefined {
  const { info, type } = property

  switch (type) {
    case ExemplarValueType.UInt8:
    case ExemplarValueType.UInt16:
    case ExemplarValueType.UInt32:
      return getItemInfo(property, index)?.min ?? info?.min ?? 0
    default:
      return getItemInfo(property, index)?.min ?? info?.min
  }
}

export function getStep(property: ExemplarProperty, index: number): number | undefined {
  const { info, type } = property

  switch (type) {
    case ExemplarValueType.UInt8:
    case ExemplarValueType.UInt16:
    case ExemplarValueType.UInt32:
    case ExemplarValueType.SInt32:
    case ExemplarValueType.SInt64:
      return getItemInfo(property, index)?.step ?? info?.step ?? 1
    case ExemplarValueType.Float32:
      return getItemInfo(property, index)?.step ?? info?.step
  }
}

export function getChoices(
  property: ExemplarProperty,
  index: number,
): ExemplarPropertyChoiceInfo[] | undefined {
  const { info } = property

  return getItemInfo(property, index)?.choices ?? info?.choices
}

export function getUnit(property: ExemplarProperty, index: number): string | undefined {
  const { info } = property

  return getItemInfo(property, index)?.unit ?? info?.unit
}

export function formatInputValue(
  value: number | string | boolean | null,
  type: ExemplarValueType,
  isHex: boolean,
): string {
  if (value === null) {
    return ""
  }

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

  if (value === "-") {
    return [value, 0]
  }

  if (type === ExemplarValueType.Float32) {
    const match = value.match(/^-?[0-9]+[.]?[0-9]{0,8}([e][0-9]{0,2})?/)
    return match ? [match[0], Number.parseFloat(match[0])] : ["", null]
  }

  const match = value.match(/^-?[0-9]+([e][0-9]{0,2})?/)
  return match ? [match[0], Number.parseInt(match[0], 10)] : ["", null]
}

function formatSingleValue(
  value: boolean | number,
  property: ExemplarProperty,
  index: number,
): string {
  const { info, type } = property

  if (isBoolean(value)) {
    return value ? "Yes" : "No"
  }

  const choices = getChoices(property, index)
  const choice = choices?.find(choice => choice.value === value)
  if (choice) {
    return choice.label
  }

  if (info?.display === "hex") {
    return toHex(value, getHexSize(type), true, true)
  }

  if (info?.display === "tgi") {
    return toHex(value, 8)
  }

  const formatted = formatInputValue(value, type, false)
  const unit = getUnit(property, index)

  if (unit) {
    return `${formatted}${unit === "%" ? "" : " "}${unit}`
  }

  return formatted
}

export function formatValue(
  value: ExemplarPropertyValue | null,
  property: ExemplarProperty,
): string {
  const { info } = property

  if (value === null) {
    return "-"
  }

  if (isString(value)) {
    return `"${value}"`
  }

  const values = isArray(value) ? value : [value]

  if (!values.length) {
    return "-"
  }

  return values
    .map((item, index) => formatSingleValue(item, property, index))
    .join(info?.display === "tgi" ? "-" : ", ")
}
