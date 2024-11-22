import type { Primitive } from "@salinco/nice-utils"

import {
  ALL,
  type OptionData,
  type OptionID,
  type OptionInfo,
  OptionType,
  type Requirements,
  isOptionSingleValue,
} from "@common/options"

import {
  loadArray,
  loadBoolean,
  loadEnum,
  loadEnumArray,
  loadInteger,
  loadRecord,
  loadString,
} from "./loader"

export function loadOptionInfo(data: OptionData): OptionInfo | undefined {
  const id = loadString(data.id, "option", "id", true) as OptionID
  const type = loadEnum(data.type, Object.values(OptionType), id, "type", true)

  const common = {
    id,
    type,
    condition: loadRequirements(data.condition, id, "condition"),
    description: loadString(data.label, id, "description"),
    global: loadBoolean(data.global, id, "global"),
    filename: loadString(data.filename, id, "filename"),
    label: loadString(data.label, id, "label"),
    section: loadString(data.section, id, "section"),
  }

  switch (type) {
    case OptionType.BOOLEAN: {
      return {
        ...common,
        default: loadBoolean(data.default, id, "default"),
        display: loadEnum(data.display, ["checkbox", "switch"] as const, id, "display"),
      }
    }

    case OptionType.NUMBER: {
      const choices = loadArray(data.choices, id, "choices")?.map(choice => {
        if (typeof choice === "object") {
          return {
            condition: loadRequirements(choice.condition, id, "condition"),
            description: loadString(choice.description, id, "description"),
            label: loadString(choice.label, id, "label"),
            value: loadInteger(choice.value, id, "value", true),
          }
        }

        return {
          value: loadInteger(choice, id, "value", true),
        }
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
        }
      }

      return {
        ...common,
        default: loadInteger(data.default, id, "default"),
        min: loadInteger(data.min, id, "min"),
        max: loadInteger(data.max, id, "max"),
        step: loadInteger(data.step, id, "step"),
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

        return {
          value: loadString(choice, id, "value", true),
        }
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
        }
      }

      return {
        ...common,
        default: loadString(data.default, id, "default"),
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
