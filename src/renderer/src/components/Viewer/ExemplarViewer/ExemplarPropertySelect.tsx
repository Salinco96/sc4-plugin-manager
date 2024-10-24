import { useMemo, useState } from "react"

import { Autocomplete, InputAdornment, TextField, createFilterOptions } from "@mui/material"

import { ExemplarProperty, ExemplarValueType } from "@common/exemplars"
import { toHex } from "@common/utils/hex"
import { isString } from "@common/utils/types"
import { FlexBox } from "@components/FlexBox"

import { CopyButton } from "./CopyButton"
import { formatInputValue, getHexSize, parseInputValue } from "./utils"

const filterOptions = createFilterOptions<{ label: string; value: number }>()

export interface ExemplarPropertySelectProps {
  description?: string
  error?: boolean
  isFirst: boolean
  isLast: boolean
  itemLabel?: string
  label: string
  name: string
  onChange: (newValue: number) => void
  original?: number
  property: ExemplarProperty
  readonly?: boolean
  value: number
}

export function ExemplarPropertySelect({
  description,
  error,
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

  const formattedValue = formatInputValue(value, type, true)

  const [inputValue, setInputValue] = useState(formattedValue)
  const [isSearching, setSearching] = useState(false)

  const isCopyable = getHexSize(type) >= 8
  const isStrict = !!info?.strict

  const options = useMemo(() => {
    const options = info?.choices?.slice() ?? []

    if (!options.some(option => option.value === value)) {
      options.push({ label: "Custom value", value })
    }

    if (original !== undefined && !options.some(option => option.value === original)) {
      options.push({ label: "Original value", value: original })
    }

    return options
  }, [info, original, value])

  const selectedOption = options.find(choice => choice.value === value)

  return (
    <Autocomplete
      blurOnSelect
      clearOnBlur
      disableClearable
      disabled={readonly}
      filterOptions={(options, params) => {
        if (!params.inputValue || params.inputValue === formattedValue) {
          return options
        }

        const filtered = filterOptions(options, params)
        const parsedValue = Number.parseInt(params.inputValue, 16)
        if (!isStrict && !options.some(choice => choice.value === parsedValue)) {
          filtered.push({ label: "Custom value", value: parsedValue })
        }

        return filtered
      }}
      freeSolo={!isStrict}
      fullWidth
      getOptionLabel={option => {
        if (isString(option)) {
          return option
        } else {
          return getOptionLabel(option, type)
        }
      }}
      handleHomeEndKeys
      id={name}
      inputValue={
        isSearching ? inputValue : selectedOption ? getOptionLabel(selectedOption, type) : ""
      }
      onChange={(event, newValue) => {
        if (!isString(newValue)) {
          onChange(newValue.value)
          setSearching(false)
        }
      }}
      onInputChange={(event, newValue) => {
        const [, parsedValue] = parseInputValue(newValue, type, true, inputValue)
        setInputValue(formatInputValue(parsedValue as number, type, true))
      }}
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
                {(isSearching || itemLabel) && (
                  <InputAdornment position="start" sx={{ marginLeft: 1 }}>
                    {itemLabel && (
                      <FlexBox marginRight={1} minWidth={120}>
                        <span style={{ flex: 1 }}>{itemLabel}</span>
                        <span style={{ paddingLeft: 8, paddingRight: 8 }}>|</span>
                      </FlexBox>
                    )}
                    {isSearching && "0x"}
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
          onChange={undefined}
          onFocus={() => {
            setInputValue(formattedValue)
            setSearching(true)
          }}
        />
      )}
      selectOnFocus
      size="small"
      title={description}
      value={selectedOption}
    />
  )
}

function getOptionLabel(option: { label: string; value: number }, type: ExemplarValueType): string {
  return `${toHex(option.value, getHexSize(type), true, true)} | ${option.label}`
}
