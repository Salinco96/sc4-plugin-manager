import {
  ALL,
  type OptionChoice,
  type OptionID,
  type OptionInfo,
  type OptionSingleValue,
  OptionType,
  type OptionValue,
  type Requirements,
  isOptionSingleValue,
} from "@common/options"
import { type Primitive, containsAll, get, isArray } from "@salinco/nice-utils"
import {
  loadArray,
  loadBoolean,
  loadEnum,
  loadEnumArray,
  loadNumber,
  loadRecord,
  loadString,
} from "./utils"

export interface OptionData {
  condition?: Requirements
  choices?: (OptionChoice | OptionSingleValue)[]
  default?: OptionValue | "all"
  description?: string
  display?: "checkbox" | "select" | "switch"
  file?: string
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

export function loadOptionInfo(data: OptionData): OptionInfo | undefined {
  const id = loadString(data.id, "option", "id", true) as OptionID
  const type = loadEnum(data.type, Object.values(OptionType), id, "type", true)

  const common = {
    id,
    condition: loadRequirements(data.condition, id, "condition"),
    description: loadString(data.description, id, "description"),
    global: loadBoolean(data.global, id, "global"),
    file: loadString(data.file, id, "filename"),
    label: loadString(data.label, id, "label"),
    section: loadString(data.section, id, "section"),
  } satisfies Partial<OptionInfo>

  switch (type) {
    case OptionType.BOOLEAN: {
      return {
        ...common,
        default: loadBoolean(data.default, id, "default"),
        display: loadEnum(data.display, ["checkbox", "switch"] as const, id, "display"),
        type,
      }
    }

    case OptionType.NUMBER: {
      const choices = loadArray(data.choices, id, "choices")?.map(choice => {
        if (typeof choice === "object") {
          return {
            condition: loadRequirements(choice.condition, id, "condition"),
            description: loadString(choice.description, id, "description"),
            label: loadString(choice.label, id, "label"),
            value: loadNumber(choice.value, id, "value", true),
          }
        }

        const value = loadNumber(choice, id, "value", true)
        return { label: String(value), value }
      })

      if (choices) {
        const multi = loadBoolean(data.multi, id, "multi")
        const values = choices.map(choice => choice.value)

        return {
          ...common,
          choices,
          default: multi
            ? data.default === ALL
              ? values
              : loadEnumArray(data.default, values, id, "default")
            : loadEnum(data.default, values, id, "default"),
          display: loadEnum(data.display, ["checkbox", "select"] as const, id, "display"),
          multi,
          type,
        }
      }

      return {
        ...common,
        default: loadNumber(data.default, id, "default"),
        min: loadNumber(data.min, id, "min"),
        max: loadNumber(data.max, id, "max"),
        step: loadNumber(data.step, id, "step"),
        type,
      }
    }

    case OptionType.STRING: {
      const choices = loadArray(data.choices, id, "choices")?.map(choice => {
        if (typeof choice === "object") {
          return {
            condition: loadRequirements(choice.condition, id, "condition"),
            description: loadString(choice.description, id, "description"),
            label: loadString(choice.label, id, "label"),
            value: loadString(choice.value, id, "value", true),
          }
        }

        const value = loadString(choice, id, "value", true)
        return { label: value, value }
      })

      if (choices) {
        const multi = loadBoolean(data.multi, id, "multi")
        const values = choices.map(choice => choice.value)

        return {
          ...common,
          choices,
          default: multi
            ? data.default === ALL
              ? values
              : loadEnumArray(data.default, values, id, "default")
            : loadEnum(data.default, values, id, "default"),
          display: loadEnum(data.display, ["checkbox", "select"] as const, id, "display"),
          multi,
          type,
        }
      }

      return {
        ...common,
        default: loadString(data.default, id, "default"),
        type,
      }
    }
  }
}

export function loadRequirements(
  value: Primitive | Requirements,
  id: string,
  field: string,
): Requirements | undefined {
  return loadRecord(value, "option value", isOptionSingleValue, id, field)
}

export function writeOptionInfo(info: OptionInfo): OptionData {
  const { choices, default: defaultValue, ...others } = info

  return {
    choices: choices?.map(choice =>
      choice.condition || choice.description || choice.label !== String(choice.value)
        ? choice
        : choice.value,
    ),
    default:
      choices && isArray(defaultValue) && containsAll(defaultValue, choices.map(get("value")))
        ? ALL
        : defaultValue,
    ...others,
  }
}
