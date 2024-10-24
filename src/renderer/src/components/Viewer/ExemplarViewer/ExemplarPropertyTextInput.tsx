import { useEffect, useState } from "react"

import { InputAdornment, TextField } from "@mui/material"

import { ExemplarProperty, ExemplarPropertyItemInfo, ExemplarValueType } from "@common/exemplars"
import { FlexBox } from "@components/FlexBox"

import { CopyButton } from "./CopyButton"
import { formatInputValue, getHexSize, getMax, getMin, getStep, parseInputValue } from "./utils"

export interface ExemplarPropertyTextInputProps {
  description?: string
  error?: boolean
  isFirst: boolean
  isLast: boolean
  itemInfo?: ExemplarPropertyItemInfo
  itemLabel?: string
  label: string
  name: string
  onChange: (newValue: number | string) => void
  property: ExemplarProperty
  readonly?: boolean
  value: number | string
}

export function ExemplarPropertyTextInput({
  description,
  error,
  isFirst,
  isLast,
  itemInfo,
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

  const formattedValue = formatInputValue(value, type, isHex)

  const [inputValue, setInputValue] = useState(formattedValue)

  const isCopyable = isHex && getHexSize(type) >= 8

  useEffect(() => {
    setInputValue(formattedValue)
  }, [formattedValue])

  return (
    <TextField
      InputProps={{
        endAdornment: isCopyable && (
          <InputAdornment position="start" sx={{ marginRight: 0 }}>
            <CopyButton text={inputValue} />
          </InputAdornment>
        ),
        inputProps: {
          max: itemInfo?.max ?? info?.max ?? getMax(type),
          maxLength: isString ? info?.maxLength : undefined,
          min: itemInfo?.min ?? info?.min ?? getMin(type),
          minLength: isString ? info?.minLength : undefined,
          step: getStep(type),
          type: getStep(type) === 1 && !isHex ? "number" : "text",
        },
        startAdornment: (!!itemLabel || isHex) && (
          <InputAdornment position="start">
            {itemLabel && (
              <FlexBox marginRight={isHex ? 1 : undefined} minWidth={120}>
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
