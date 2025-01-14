import { Box, InputAdornment, TextField } from "@mui/material"
import { isNumber, toHex } from "@salinco/nice-utils"
import { useEffect, useMemo, useRef, useState } from "react"

import { ExemplarDisplayType, type ExemplarProperty, ExemplarValueType } from "@common/exemplars"
import { FlexRow } from "@components/FlexBox"

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
  useExemplarPropertyInfo,
} from "./utils"

export interface ExemplarPropertyTextInputProps {
  description: string | undefined
  error: boolean | undefined
  index: number
  isExpandable: boolean
  isExpanded: boolean
  isFirst: boolean
  isLast: boolean
  itemLabel: string | undefined
  label: string
  name: string
  onChange: (newValue: number | string | null) => void
  openColorPicker: () => void
  property: ExemplarProperty
  readonly: boolean
  setExpanded?: (isExpanded: boolean) => void
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
  openColorPicker,
  property,
  readonly,
  setExpanded,
  value,
}: ExemplarPropertyTextInputProps): JSX.Element {
  const { type } = property

  const info = useExemplarPropertyInfo(property.id)
  const itemInfo = getItemInfo(info, index)

  const isString = type === ExemplarValueType.String
  const isHex = itemInfo?.display !== undefined

  const max = itemInfo?.max ?? getMax(type)
  const min = itemInfo?.min ?? getMin(type)
  const step = itemInfo?.step ?? getStep(type, max)
  const unit = itemInfo?.unit

  const ref = useRef<HTMLInputElement | null>(null)

  const formattedValue = formatInputValue(value, type, isHex)

  const [inputValue, setInputValue] = useState(formattedValue)

  const isCopyable = isHex && getHexSize(type) >= 8

  const color = useMemo(() => {
    if (isNumber(value) && type === ExemplarValueType.UInt32) {
      switch (itemInfo?.display) {
        case ExemplarDisplayType.RGB:
          return `#${toHex(value, 8).slice(-6)}`
        case ExemplarDisplayType.RGBA:
          return `#${toHex(value, 8)}`
      }
    }
  }, [itemInfo, type, value])

  useEffect(() => {
    setInputValue(formattedValue)
  }, [formattedValue])

  return (
    <TextField
      InputProps={{
        endAdornment: (isCopyable || unit || color) && (
          <InputAdornment position="start" sx={{ gap: 1, marginLeft: 1, marginRight: 0 }}>
            {unit}
            {color && (
              <Box
                bgcolor={color}
                border="1px solid #888"
                height={20}
                onClick={readonly ? undefined : openColorPicker}
                title={readonly ? undefined : "Open color picker"}
                sx={{ cursor: readonly ? undefined : "pointer" }}
                width={40}
              />
            )}
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
        ref,
        startAdornment: (!!itemLabel || isHex) && (
          <InputAdornment position="start">
            <FlexRow gap={1}>
              {itemLabel && (
                <FlexRow minWidth={160}>
                  <span style={{ flex: 1 }}>{itemLabel}</span>
                  <span style={{ paddingLeft: 8, paddingRight: 8 }}>|</span>
                </FlexRow>
              )}
              {isHex && (color ? "#" : "0x")}
            </FlexRow>
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
            {isExpandable && setExpanded && (
              <ExpandButton isExpanded={!!isExpanded} setExpanded={setExpanded} />
            )}
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
        setExpanded?.(true)
      }}
      size="small"
      title={description}
      value={inputValue}
      variant="outlined"
    />
  )
}
