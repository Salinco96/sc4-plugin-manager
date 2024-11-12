import { useMemo } from "react"

import { ExemplarDisplayType, type ExemplarProperty, ExemplarValueType } from "@common/exemplars"
import { toHex } from "@common/utils/hex"
import { isArray, isBoolean, isNumber, isString } from "@common/utils/types"

import { ExemplarPropertySelect } from "./ExemplarPropertySelect"
import { ExemplarPropertySwitch } from "./ExemplarPropertySwitch"
import { ExemplarPropertyTextInput } from "./ExemplarPropertyTextInput"
import { getItemInfo } from "./utils"

export interface ExemplarPropertyInputProps<T extends boolean | number | string> {
  error?: boolean
  index?: number
  isExpandable: boolean
  isExpanded: boolean
  isFirst: boolean
  isLast: boolean
  name: string
  onChange: (newValue: T) => void
  openColorPicker: () => void
  original?: T | null
  property: ExemplarProperty
  readonly?: boolean
  setExpanded: (isExpanded: boolean) => void
  value: T | null
}

export function ExemplarPropertyInput<T extends boolean | number | string>({
  index = 0,
  onChange,
  openColorPicker,
  original,
  property,
  value,
  ...others
}: ExemplarPropertyInputProps<T>): JSX.Element {
  const { id, info, type } = property

  const itemInfo = getItemInfo(property, index)

  const isTGI = itemInfo?.display === ExemplarDisplayType.TGI

  const idLabel = toHex(id, 8, true)
  const typeLabel = isTGI ? "TGI" : ExemplarValueType[type]
  const label = `${info && id ? `${info.name} (${idLabel})` : info?.name ?? idLabel} - ${typeLabel}`

  const description = itemInfo?.desc ?? info?.desc

  const totalCount = isArray(property.value) ? property.value.length : 1

  const itemLabel = useMemo(() => {
    if (itemInfo?.name && itemInfo !== info) {
      return itemInfo.name
    }

    if (isTGI) {
      return ["Type", "Group", "Instance"][3 - totalCount + index]
    }
  }, [index, info, isTGI, itemInfo, totalCount])

  if (isBoolean(value) || type === ExemplarValueType.Bool) {
    return (
      <ExemplarPropertySwitch
        {...others}
        description={description}
        label={label}
        onChange={newValue => onChange(newValue as T)}
        value={Boolean(value)}
      />
    )
  }

  if (itemInfo?.choices && !isString(value)) {
    return (
      <ExemplarPropertySelect
        {...others}
        description={description}
        index={index}
        itemLabel={itemLabel}
        label={label}
        onChange={newValue => onChange(newValue as T)}
        original={isNumber(original) ? original : undefined}
        property={property}
        value={value}
      />
    )
  }

  return (
    <ExemplarPropertyTextInput
      {...others}
      description={description}
      index={index}
      itemLabel={itemLabel}
      label={label}
      onChange={newValue => onChange(newValue as T)}
      openColorPicker={openColorPicker}
      property={property}
      value={value}
    />
  )
}
