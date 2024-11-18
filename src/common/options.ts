import { Namespace, TFunction } from "i18next"

import { getFeatureLabel } from "./i18n"
import { Feature, ID } from "./types"
import { isArrayOf, isBoolean, isNumber, isString } from "./utils/types"

export const ALL = "all"

export type OptionID = ID<OptionInfo>

export enum OptionType {
  BOOLEAN = "boolean",
  NUMBER = "number",
  STRING = "string",
}

export interface OptionChoice<$Type extends OptionType = OptionType> {
  condition?: Requirements
  description?: string
  label?: string
  value: OptionSingleValue<$Type>
}

export interface OptionData {
  condition?: Requirements
  choices?: (OptionChoice | OptionSingleValue)[]
  default?: OptionValue | typeof ALL
  description?: string
  display?: "checkbox" | "select" | "switch"
  filename?: string
  global?: boolean
  id: OptionID
  label?: string
  max?: number
  min?: number
  multi?: boolean
  section?: string
  step?: number
  type: OptionType
}

export interface OptionInfo<$Type extends OptionType = OptionType, $Multi extends boolean = boolean>
  extends OptionData {
  choices?: OptionChoice<Exclude<$Type, OptionType.BOOLEAN>>[]
  default?: OptionValue<$Type, $Multi>
  type: $Type
}

export type OptionSingleValue<$Type extends OptionType = OptionType> = {
  [OptionType.BOOLEAN]: boolean
  [OptionType.NUMBER]: number
  [OptionType.STRING]: string
}[$Type]

export type OptionValue<
  $Type extends OptionType = OptionType,
  $Multi extends boolean = boolean,
> = $Multi extends true ? OptionSingleValue<$Type>[] : OptionSingleValue<$Type>

export type Options = {
  [optionId in OptionID]?: OptionValue
}

export type Requirements = {
  [optionId in OptionID | Feature]?: OptionSingleValue
}

const defaultValues: {
  [$Type in OptionType]: OptionSingleValue<$Type>
} = {
  [OptionType.BOOLEAN]: false,
  [OptionType.NUMBER]: 0,
  [OptionType.STRING]: "default",
}

/**
 * Gets the default value of an option
 */
export function getOptionDefaultValue<$Type extends OptionType, $Multi extends boolean>(
  option: OptionInfo<$Type, $Multi>,
): OptionValue<$Type, $Multi> {
  if (option.default !== undefined) {
    return option.default
  }

  if (option.multi) {
    return [] as OptionValue<$Type, $Multi & true>
  }

  if (option.choices) {
    return option.choices[0].value as OptionValue<Exclude<$Type, OptionType.BOOLEAN>, $Multi>
  }

  if (option.min) {
    return option.min as OptionValue<$Type, $Multi>
  }

  return defaultValues[option.type] as OptionValue<$Type, $Multi>
}

/**
 * Gets the value of an option (or the default if not set)
 */
export function getOptionValue<$Type extends OptionType, $Multi extends boolean>(
  option: OptionInfo<$Type, $Multi>,
  options: Options | undefined,
): OptionValue<$Type, $Multi> {
  return (options?.[option.id] as OptionValue<$Type, $Multi>) ?? getOptionDefaultValue(option)
}

/**
 * Gets an option info by ID
 */
export function getOptionInfo(
  optionID: OptionID,
  packageOptions: ReadonlyArray<OptionInfo> | undefined,
  globalOptions: ReadonlyArray<OptionInfo> | undefined,
): OptionInfo | undefined {
  const packageOption = packageOptions?.find(option => option.id === optionID)
  if (packageOption && !packageOption.global) {
    return packageOption
  }

  const globalOption = globalOptions?.find(option => option.id === optionID)
  if (globalOption) {
    return globalOption
  }
}

/**
 * Gets the label for a requirement
 */
export function getRequirementLabel(
  t: TFunction<Namespace>,
  requirement: OptionID | Feature,
  packageOptions: OptionInfo[] | undefined,
  globalOptions: OptionInfo[] | undefined,
): string {
  const option = getOptionInfo(requirement as OptionID, packageOptions, globalOptions)
  return option?.label ?? getFeatureLabel(t, requirement as Feature)
}

/**
 * Gets the label for a requirement value
 */
export function getRequirementValueLabel(
  t: TFunction<Namespace>,
  requirement: OptionID | Feature,
  value: OptionSingleValue,
  packageOptions: OptionInfo[] | undefined,
  globalOptions: OptionInfo[] | undefined,
): string {
  if (isBoolean(value)) {
    return t(value ? "yes" : "no", { ns: "General" })
  }

  const option = getOptionInfo(requirement as OptionID, packageOptions, globalOptions)
  return option?.choices?.find(choice => choice.value === value)?.label ?? String(value)
}

/**
 * Checks whether the given option value is equal to the default
 */
export function isOptionDefaultValue(option: OptionInfo, value: OptionValue | undefined): boolean {
  // If value is undefined, it will default to the default, so always true!
  if (value === undefined) {
    return true
  }

  const defaultValue = getOptionDefaultValue(option)

  return Array.isArray(defaultValue)
    ? Array.isArray(value) &&
        defaultValue.length === value.length &&
        defaultValue.every(item => value.includes(item))
    : defaultValue === value
}

/**
 * Checks whether the given value is a valid single option value
 */
export function isOptionSingleValue(value: unknown): value is OptionSingleValue {
  return isBoolean(value) || isNumber(value) || isString(value)
}

/**
 * Checks whether the given value is a valid option value or array of values
 */
export function isOptionValue(value: unknown): value is OptionValue {
  return isOptionSingleValue(value) || isArrayOf(value, isOptionSingleValue)
}
