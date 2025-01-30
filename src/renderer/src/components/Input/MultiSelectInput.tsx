import {
  Autocomplete,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material"
import { type ReactNode, useMemo } from "react"

import { type SelectOption, isOptionDisabled } from "./SelectInput"

export type MultiSelectInputProps<T extends string> = {
  disabled?: boolean
  enableSearch?: boolean
  label: ReactNode
  name: string
  onChange: (value: T[]) => void
  options: SelectOption<T>[]
  required?: boolean
  value: T[] | undefined
}

export function MultiSelectInput<T extends string>({
  disabled,
  enableSearch,
  label,
  name,
  onChange,
  options,
  required,
  value,
}: MultiSelectInputProps<T>): JSX.Element {
  const selectedOptions = useMemo(() => {
    return (
      value
        ?.map(value => options.find(option => option.value === value))
        .filter(option => !!option) ?? []
    )
  }, [options, value])

  if (enableSearch) {
    return (
      <Autocomplete<SelectOption<T>, true, boolean>
        disabled={disabled}
        disableClearable={required}
        disablePortal
        fullWidth
        getOptionDisabled={isOptionDisabled}
        multiple
        onChange={(_, options) => onChange(options.map(option => option.value))}
        options={options}
        renderInput={inputProps => (
          <TextField {...inputProps} label={label} name={name} required={required} />
        )}
        renderTags={(options, getTagProps) =>
          options.map((option, index) => {
            const { key, ...tagProps } = getTagProps({ index })
            return (
              <Chip
                key={key}
                label={option.label}
                {...tagProps}
                disabled={option.fixed || (required && options.length === 1)}
                size="small"
              />
            )
          })
        }
        size="small"
        value={selectedOptions}
      />
    )
  }

  return (
    <FormControl disabled={disabled} fullWidth size="small">
      <InputLabel id={`${name}-label`}>{label}</InputLabel>
      <Select<T[]>
        label={label}
        id={`${name}-select`}
        labelId={`${name}-label`}
        multiple
        onChange={event => {
          const value = event.target.value
          onChange(Array.isArray(value) ? value : [value as T])
        }}
        required={required}
        value={value ?? []}
      >
        {options.map(option => (
          <MenuItem disabled={option.disabled} key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
