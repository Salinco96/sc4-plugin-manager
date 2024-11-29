import {
  forEach,
  isArray,
  isBoolean,
  isEqual,
  isNumber,
  isString,
  toHex,
} from "@salinco/nice-utils"

import {
  type ExemplarData,
  type ExemplarDataPatch,
  ExemplarDisplayType,
  type ExemplarProperty,
  type ExemplarPropertyInfo,
  type ExemplarPropertyItemInfo,
  type ExemplarPropertyValue,
  ExemplarValueType,
} from "@common/exemplars"
import { useExemplarProperties } from "@utils/store"

export function isEqualPropertyValue(
  value: ExemplarPropertyValue | null,
  other: ExemplarPropertyValue | null,
): boolean {
  if (isArray(value) && isNumber(other)) {
    return value.length === 1 && value[0] === other
  }

  if (isArray(other) && isNumber(value)) {
    return other.length === 1 && other[0] === value
  }

  return isEqual(value, other)
}

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

  for (const propertyId in currentData.properties) {
    const currentValue = currentData.properties[propertyId]?.value ?? null
    const originalValue = originalData.properties[propertyId]?.value ?? null
    if (!isEqualPropertyValue(currentValue, originalValue)) {
      diff ??= {}
      diff.properties ??= {}
      diff.properties[toHex(Number(propertyId), 8)] = currentValue
    }
  }

  for (const propertyId in originalData.properties) {
    const currentValue = currentData.properties[propertyId]?.value ?? null
    if (currentValue === null) {
      diff ??= {}
      diff.properties ??= {}
      diff.properties[toHex(Number(propertyId), 8)] = null
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

export function getDefaultValue(info: ExemplarPropertyInfo): ExemplarPropertyValue {
  if (info.default !== undefined) {
    return info.default
  }

  if (info.choices?.length) {
    return info.choices[0].value
  }

  if (info.type === ExemplarValueType.Bool) {
    return false
  }

  if (info.type === ExemplarValueType.String) {
    return ""
  }

  if (info.size === 1) {
    return 0
  }

  return Array(info.size ?? info.minLength ?? 1).fill(0)
}

export function getItemInfo(
  info: ExemplarPropertyInfo | undefined,
  index: number,
): ExemplarPropertyItemInfo | undefined {
  const itemInfo = info?.items?.at(info?.size && info.repeat ? index % info.size : index)
  return itemInfo ? { ...info, ...itemInfo } : info
}

export function getErrors(
  data: ExemplarData,
  exemplarProperties: {
    [propertyId in number]?: ExemplarPropertyInfo
  },
): ExemplarErrors | undefined {
  let errors: ExemplarErrors | undefined

  forEach(data.properties, property => {
    const propertyErrors = getPropertyErrors(property, exemplarProperties[property.id])
    if (propertyErrors) {
      errors ??= {}
      errors.properties ??= {}
      errors.properties[property.id] = propertyErrors
    }
  })

  return errors
}

function getPropertyErrors(
  property: ExemplarProperty,
  info: ExemplarPropertyInfo | undefined,
): PropertyErrors | undefined {
  const { type, value } = property

  const maxLength = info?.maxLength ?? 64
  const minLength = info?.minLength ?? 0

  if (type === ExemplarValueType.String) {
    if (!isString(value)) {
      return "Mismatching type"
    }

    if (info?.size && value.length !== info.size) {
      return `Must contain ${info.size} character(s)`
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
        return `Must contain a multiple of ${info.size} items`
      }
    } else if (values.length !== info.size) {
      return `Must contain ${info.size} item(s)`
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

    const itemInfo = getItemInfo(info, index)

    const choices = itemInfo?.choices
    const isStrict = !!itemInfo?.strict

    if (isStrict && choices && !choices.some(choice => choice.value === item)) {
      return "Unsupported value"
    }

    const max = itemInfo?.max ?? getMax(property.type)
    const min = itemInfo?.min ?? getMin(property.type)

    if (min !== undefined && item < min) {
      return `Min ${formatSingleValue(min, property, info, index)}`
    }

    if (max !== undefined && item > max) {
      return `Max ${formatSingleValue(max, property, info, index)}`
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

export function getStep(type: ExemplarValueType, max: number | undefined): number | undefined {
  switch (type) {
    case ExemplarValueType.Float32:
      return max === 1 ? 0.01 : 1
    case ExemplarValueType.UInt8:
    case ExemplarValueType.UInt16:
    case ExemplarValueType.UInt32:
    case ExemplarValueType.SInt32:
    case ExemplarValueType.SInt64:
      return 1
  }
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
    return `0x${toHex(value, getHexSize(type)).toUpperCase()}`
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
  info: ExemplarPropertyInfo | undefined,
  index: number,
): string {
  const { type } = property
  if (isBoolean(value)) {
    return value ? "Yes" : "No"
  }

  const itemInfo = getItemInfo(info, index)
  const choice = itemInfo?.choices?.find(choice => choice.value === value)
  if (choice) {
    return choice.label
  }

  switch (itemInfo?.display) {
    case ExemplarDisplayType.HEX:
    case ExemplarDisplayType.RGB:
      return `0x${toHex(value, getHexSize(type)).toUpperCase()}`
    case ExemplarDisplayType.TGI:
      return toHex(value, getHexSize(type))
  }

  const formatted = formatInputValue(value, type, false)
  const unit = itemInfo?.unit

  if (unit) {
    return `${formatted}${unit === "%" ? "" : " "}${unit}`
  }

  return formatted
}

export function formatValue(
  value: ExemplarPropertyValue | null,
  property: ExemplarProperty,
  info: ExemplarPropertyInfo | undefined,
): string {
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
    .map((item, index) => formatSingleValue(item, property, info, index))
    .join(info?.display === "tgi" ? "-" : ", ")
}

// Not a property, but we treat it as such internally, hardcoded to ID 0x00000000
export const PARENT_COHORT_ID_INFO = {
  display: ExemplarDisplayType.TGI,
  id: 0,
  name: "Parent Cohort ID",
  size: 3,
  type: ExemplarValueType.UInt32,
} satisfies ExemplarPropertyInfo

export function useExemplarPropertyInfo(propertyId: number): ExemplarPropertyInfo | undefined {
  const exemplarProperties = useExemplarProperties()

  if (propertyId === PARENT_COHORT_ID_INFO.id) {
    return PARENT_COHORT_ID_INFO
  }

  return exemplarProperties[propertyId]
}
