import { useEffect, useState } from "react"

import { InputAdornment, TextField } from "@mui/material"

import { ExemplarProperty, ExemplarValueType } from "@common/exemplars"
import { FlexBox } from "@components/FlexBox"

import { CopyButton } from "./CopyButton"
import {
  formatInputValue,
  getHexSize,
  getMax,
  getMin,
  getStep,
  getUnit,
  parseInputValue,
} from "./utils"

export interface ExemplarPropertyTextInputProps {
  description?: string
  error?: boolean
  index: number
  isFirst: boolean
  isLast: boolean
  itemLabel?: string
  label: string
  name: string
  onChange: (newValue: number | string | null) => void
  property: ExemplarProperty
  readonly?: boolean
  value: number | string | null
}

export function ExemplarPropertyTextInput({
  description,
  error,
  index,
  isFirst,
  isLast,
  itemLabel,
  label,
  name,
  onChange,
  property,
  readonly,
  value,
}: ExemplarPropertyTextInputProps): JSX.Element {
  const { info, type } = property

  const isHex = info?.display === "tgi" || info?.display === "hex"
  const isString = type === ExemplarValueType.String
  const unit = getUnit(property, index)

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
          max: getMax(property, index),
          maxLength: isString ? info?.maxLength : undefined,
          min: getMin(property, index),
          minLength: isString ? info?.minLength : undefined,
          step: getStep(property, index),
          type: getStep(property, index) && !isHex ? "number" : "text",
        },
        startAdornment: (!!itemLabel || isHex) && (
          <InputAdornment position="start">
            {itemLabel && (
              <FlexBox marginRight={isHex ? 1 : undefined} minWidth={160}>
                <span style={{ flex: 1 }}>{itemLabel}</span>
                <span style={{ paddingLeft: 8, paddingRight: 8 }}>|</span>
              </FlexBox>
            )}
            {isHex && "0x"}
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
      label={isFirst ? label : undefined}
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
      size="small"
      title={description}
      value={inputValue}
      variant="outlined"
    />
  )
}
