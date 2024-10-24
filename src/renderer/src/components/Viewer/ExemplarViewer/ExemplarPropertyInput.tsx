import { useMemo } from "react"

import { type ExemplarProperty, ExemplarValueType } from "@common/exemplars"
import { toHex } from "@common/utils/hex"
import { isArray, isBoolean, isNumber } from "@common/utils/types"

import { ExemplarPropertySelect } from "./ExemplarPropertySelect"
import { ExemplarPropertySwitch } from "./ExemplarPropertySwitch"
import { ExemplarPropertyTextInput } from "./ExemplarPropertyTextInput"

export const InputProps: {
  [type in ExemplarValueType]: {
    max?: number
    min?: number
    step?: number
  }
} = {
  [ExemplarValueType.UInt8]: {
    max: 255,
    min: 0,
    step: 1,
  },
  [ExemplarValueType.UInt16]: {
    max: 65535,
    min: 0,
    step: 1,
  },
  [ExemplarValueType.UInt32]: {
    min: 0,
    step: 1,
  },
  [ExemplarValueType.SInt32]: {
    step: 1,
  },
  [ExemplarValueType.SInt64]: {
    step: 1,
  },
  [ExemplarValueType.Float32]: {},
  [ExemplarValueType.Bool]: {},
  [ExemplarValueType.String]: {},
}

export interface ExemplarPropertyInputProps<T extends boolean | number | string> {
  error?: boolean
  index?: number
  name: string
  onChange: (newValue: T) => void
  original?: T | null
  property: ExemplarProperty
  readonly?: boolean
  value: T
}

export function ExemplarPropertyInput<T extends boolean | number | string>({
  error,
  index,
  name,
  onChange,
  original,
  property,
  readonly,
  value,
}: ExemplarPropertyInputProps<T>): JSX.Element {
  const { id, info, type } = property

  const isTGI = info?.display === "tgi"

  const itemInfo = info?.items?.at(index ?? 0)

  const idLabel = toHex(id, 8, true)
  const typeLabel = isTGI ? "TGI" : ExemplarValueType[type]

  const label = `${info && id ? `${info.name} (${idLabel})` : info?.name ?? idLabel} - ${typeLabel}`

  const description = itemInfo?.desc ?? info?.desc

  const totalCount = isArray(property.value) ? property.value.length : 1
  const isFirst = index === undefined || index === 0
  const isLast = index === undefined || index === totalCount - 1

  const itemLabel = useMemo(() => {
    if (itemInfo?.name) {
      return itemInfo.name
    }

    if (isTGI && index !== undefined) {
      return ["Type", "Group", "Instance"][3 - totalCount + index]
    }
  }, [index, isTGI, itemInfo, totalCount])

  if (isBoolean(value) || type === ExemplarValueType.Bool) {
    return (
      <ExemplarPropertySwitch
        description={description}
        label={label}
        name={name}
        onChange={newValue => onChange(newValue as T)}
        readonly={readonly}
        value={Boolean(value)}
      />
    )
  }

  if (isNumber(value) && info?.choices) {
    return (
      <ExemplarPropertySelect
        description={description}
        error={error}
        isFirst={isFirst}
        isLast={isLast}
        itemLabel={itemLabel}
        label={label}
        name={name}
        onChange={newValue => onChange(newValue as T)}
        original={isNumber(original) ? original : undefined}
        property={property}
        readonly={readonly}
        value={value}
      />
    )
  }

  return (
    <ExemplarPropertyTextInput
      description={description}
      error={error}
      isFirst={isFirst}
      isLast={isLast}
      itemInfo={itemInfo}
      itemLabel={itemLabel}
      label={label}
      name={name}
      onChange={newValue => onChange(newValue as T)}
      property={property}
      readonly={readonly}
      value={value}
    />
  )
}
