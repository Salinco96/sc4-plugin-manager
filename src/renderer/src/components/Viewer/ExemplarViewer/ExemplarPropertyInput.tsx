import { useMemo } from "react"

import { type ExemplarProperty, ExemplarValueType } from "@common/exemplars"
import { toHex } from "@common/utils/hex"
import { isArray, isBoolean, isNumber, isString } from "@common/utils/types"

import { ExemplarPropertySelect } from "./ExemplarPropertySelect"
import { ExemplarPropertySwitch } from "./ExemplarPropertySwitch"
import { ExemplarPropertyTextInput } from "./ExemplarPropertyTextInput"
import { getChoices, getItemInfo } from "./utils"

export interface ExemplarPropertyInputProps<T extends boolean | number | string> {
  error?: boolean
  index?: number
  name: string
  onChange: (newValue: T) => void
  original?: T | null
  property: ExemplarProperty
  readonly?: boolean
  value: T | null
}

export function ExemplarPropertyInput<T extends boolean | number | string>({
  error,
  index = 0,
  name,
  onChange,
  original,
  property,
  readonly,
  value,
}: ExemplarPropertyInputProps<T>): JSX.Element {
  const { id, info, type } = property

  const isTGI = info?.display === "tgi"

  const itemInfo = getItemInfo(property, index)
  const choices = getChoices(property, index)

  const idLabel = toHex(id, 8, true)
  const typeLabel = isTGI ? "TGI" : ExemplarValueType[type]

  const label = `${info && id ? `${info.name} (${idLabel})` : info?.name ?? idLabel} - ${typeLabel}`

  const description = itemInfo?.desc ?? info?.desc

  const totalCount = isArray(property.value) ? property.value.length : 1
  const isFirst = index === 0
  const isLast = index >= totalCount - 1

  const itemLabel = useMemo(() => {
    if (itemInfo?.name) {
      return itemInfo.name
    }

    if (isTGI) {
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

  if (choices && !isString(value)) {
    return (
      <ExemplarPropertySelect
        description={description}
        error={error}
        index={index}
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
      index={index}
      isFirst={isFirst}
      isLast={isLast}
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
