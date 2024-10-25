import { useMemo, useState } from "react"

import { Autocomplete, Box, InputAdornment, TextField, createFilterOptions } from "@mui/material"

import { ExemplarProperty, ExemplarPropertyChoiceInfo, ExemplarValueType } from "@common/exemplars"
import { toHex } from "@common/utils/hex"
import { isString } from "@common/utils/types"
import { FlexBox } from "@components/FlexBox"

import { CopyButton } from "./CopyButton"
import { formatInputValue, getChoices, getHexSize, parseInputValue } from "./utils"

export interface ExemplarPropertySelectProps {
  description?: string
  error?: boolean
  index: number
  isFirst: boolean
  isLast: boolean
  itemLabel?: string
  label: string
  name: string
  onChange: (newValue: number) => void
  original?: number
  property: ExemplarProperty
  readonly?: boolean
  value: number | null
}

export function ExemplarPropertySelect({
  description,
  error,
  index,
  isFirst,
  isLast,
  itemLabel,
  label,
  name,
  onChange,
  original,
  property,
  readonly,
  value,
}: ExemplarPropertySelectProps): JSX.Element {
  const { info, type } = property

  const choices = getChoices(property, index)

  const isHex = [
    ExemplarValueType.UInt8,
    ExemplarValueType.UInt16,
    ExemplarValueType.UInt32,
  ].includes(type)

  const filterOptions = useMemo(() => {
    return createFilterOptions<ExemplarPropertyChoiceInfo>({
      stringify(option) {
        return `${formatInputValue(option.value, type, isHex)} | ${option.label}`
      },
    })
  }, [isHex, type])

  const formattedValue = formatInputValue(value, type, isHex)

  const [inputValue, setInputValue] = useState(formattedValue)
  const [isSearching, setSearching] = useState(false)

  const isCopyable = isHex && getHexSize(type) >= 8
  const isStrict = !!info?.strict

  const options = useMemo(() => {
    const options = choices?.slice() ?? []

    if (value !== null && !options.some(option => option.value === value)) {
      options.push({ label: "Custom value", value })
    }

    if (original !== undefined && !options.some(option => option.value === original)) {
      options.push({ label: "Original value", value: original })
    }

    return options
  }, [choices, original, value])

  const selectedOption = options.find(choice => choice.value === value)

  return (
    <Autocomplete
      autoHighlight
      blurOnSelect
      clearOnBlur
      disableClearable
      disabled={readonly}
      filterOptions={(options, params) => {
        if (!params.inputValue || params.inputValue === formattedValue) {
          return options
        }

        const filtered = filterOptions(options, params)

        const parsedValue = isHex
          ? Number.parseInt(params.inputValue, 16)
          : Number.parseFloat(params.inputValue)

        if (Number.isFinite(parsedValue)) {
          if (!isStrict && !options.some(choice => choice.value === parsedValue)) {
            filtered.push({ label: "Custom value", value: parsedValue })
          }
        }

        return filtered
      }}
      freeSolo={!isStrict}
      fullWidth
      getOptionLabel={option => {
        if (isString(option)) {
          return option
        } else {
          return option.label
        }
      }}
      handleHomeEndKeys
      id={name}
      inputValue={isSearching ? inputValue : selectedOption?.label ?? ""}
      onChange={(event, newValue) => {
        if (!isString(newValue)) {
          onChange(newValue.value)
          setSearching(false)
        }
      }}
      onInputChange={(event, newValue) => {
        const [newInputValue, parsedValue] = parseInputValue(newValue, type, isHex, inputValue)
        setInputValue(isHex ? formatInputValue(parsedValue as number, type, isHex) : newInputValue)
      }}
      openOnFocus
      options={options}
      renderInput={inputProps => (
        <TextField
          {...inputProps}
          InputProps={{
            ...inputProps.InputProps,
            endAdornment: (
              <>
                {isCopyable && !isSearching && (
                  <InputAdornment position="start" sx={{ marginRight: 0 }}>
                    <CopyButton text={formattedValue} />
                  </InputAdornment>
                )}
                {inputProps.InputProps.endAdornment}
              </>
            ),
            startAdornment: (
              <>
                {inputProps.InputProps.startAdornment}
                {(itemLabel || isHex || (!isSearching && value !== null)) && (
                  <InputAdornment position="start" sx={{ marginLeft: 1, marginRight: 0 }}>
                    {itemLabel && (
                      <FlexBox marginRight={1} minWidth={160}>
                        <span style={{ flex: 1 }}>{itemLabel}</span>
                        <span style={{ paddingLeft: 8, paddingRight: 8 }}>|</span>
                      </FlexBox>
                    )}
                    {isHex && isSearching && "0x"}
                    {!isSearching && value !== null && (
                      <FlexBox minWidth={160}>
                        <span style={{ flex: 1 }}>
                          {isHex ? toHex(value, getHexSize(type), true, true) : value}
                        </span>
                        <span style={{ paddingLeft: 8, paddingRight: 8 }}>|</span>
                      </FlexBox>
                    )}
                  </InputAdornment>
                )}
              </>
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
          error={error}
          label={isFirst ? label : undefined}
          name={name}
          onBlur={() => {
            setInputValue("")
            setSearching(false)
          }}
          onFocus={() => {
            setInputValue(formattedValue)
            setSearching(true)
          }}
          placeholder={isSearching ? undefined : "-"}
        />
      )}
      renderOption={(optionProps, option) => (
        <Box component="li" {...optionProps} style={{ paddingLeft: 14 }} key={option.value}>
          <InputAdornment position="start" sx={{ marginLeft: 0, marginRight: 0 }}>
            <FlexBox marginRight={isSearching ? 1 : undefined} minWidth={160}>
              <span style={{ flex: 1 }}>{toHex(option.value, getHexSize(type), true, true)}</span>
              <span style={{ paddingLeft: 8, paddingRight: 8 }}>|</span>
            </FlexBox>
          </InputAdornment>
          {option.label}
        </Box>
      )}
      selectOnFocus
      size="small"
      title={description}
      value={selectedOption}
    />
  )
}
