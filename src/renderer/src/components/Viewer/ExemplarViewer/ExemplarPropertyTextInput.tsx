import { useEffect, useState } from "react"

import { InputAdornment, TextField } from "@mui/material"

import { ExemplarProperty, ExemplarValueType } from "@common/exemplars"
import { FlexBox } from "@components/FlexBox"

import { CopyButton } from "./CopyButton"
import { ExpandButton } from "./ExpandButton"
import {
  formatInputValue,
  getHexSize,
  getItemInfo,
  getMax,
  getMin,
  getStep,
  parseInputValue,
} from "./utils"

export interface ExemplarPropertyTextInputProps {
  description?: string
  error?: boolean
  index: number
  isExpandable?: boolean
  isExpanded?: boolean
  isFirst: boolean
  isLast: boolean
  itemLabel?: string
  label: string
  name: string
  onChange: (newValue: number | string | null) => void
  property: ExemplarProperty
  readonly?: boolean
  setExpanded: (isExpanded: boolean) => void
  value: number | string | null
}

export function ExemplarPropertyTextInput({
  description,
  error,
  index,
  isExpandable,
  isExpanded,
  isFirst,
  isLast,
  itemLabel,
  label,
  name,
  onChange,
  property,
  readonly,
  setExpanded,
  value,
}: ExemplarPropertyTextInputProps): JSX.Element {
  const { info, type } = property

  const itemInfo = getItemInfo(property, index)
  const isString = type === ExemplarValueType.String
  const isHex = itemInfo?.display !== undefined

  const max = itemInfo?.max ?? getMax(type)
  const min = itemInfo?.min ?? getMin(type)
  const step = itemInfo?.step ?? getStep(type, max)
  const unit = itemInfo?.unit

  const formattedValue = formatInputValue(value, type, isHex)

  const [inputValue, setInputValue] = useState(formattedValue)

  const isCopyable = isHex && getHexSize(type) >= 8

  useEffect(() => {
    setInputValue(formattedValue)
  }, [formattedValue])

  return (
    <TextField
      InputProps={{
        endAdornment: (isCopyable || unit) && (
          <InputAdornment position="start" sx={{ marginLeft: 1, marginRight: 0 }}>
            {unit}
            {isCopyable && <CopyButton text={inputValue} />}
          </InputAdornment>
        ),
        inputProps: {
          max,
          maxLength: isString ? info?.maxLength : undefined,
          min,
          minLength: isString ? info?.minLength : undefined,
          step,
          type: step && !isHex ? "number" : "text",
        },
        startAdornment: (!!itemLabel || isHex) && (
          <InputAdornment position="start">
            <FlexBox gap={1}>
              {itemLabel && (
                <FlexBox minWidth={160}>
                  <span style={{ flex: 1 }}>{itemLabel}</span>
                  <span style={{ paddingLeft: 8, paddingRight: 8 }}>|</span>
                </FlexBox>
              )}
              {isHex && "0x"}
            </FlexBox>
          </InputAdornment>
        ),
        sx: {
          borderBottomLeftRadius: isLast ? undefined : 0,
          borderBottomRightRadius: isLast ? undefined : 0,
          borderTopLeftRadius: isFirst ? undefined : 0,
          borderTopRightRadius: isFirst ? undefined : 0,
          marginTop: isFirst ? undefined : "-1px",
          overflow: "hidden",
        },
      }}
      disabled={readonly}
      error={error}
      fullWidth
      id={name}
      label={
        isFirst ? (
          <>
            {isExpandable && <ExpandButton isExpanded={!!isExpanded} setExpanded={setExpanded} />}
            {label}
          </>
        ) : undefined
      }
      name={name}
      onBlur={() => {
        setInputValue(formattedValue)
      }}
      onChange={event => {
        const [newInputValue, parsedValue] = parseInputValue(
          event.target.value,
          type,
          isHex,
          inputValue,
        )

        setInputValue(newInputValue)
        if (parsedValue !== null && parsedValue !== value) {
          onChange(parsedValue as number | string)
        }
      }}
      onFocus={() => {
        setExpanded(true)
      }}
      size="small"
      title={description}
      value={inputValue}
      variant="outlined"
    />
  )
}
