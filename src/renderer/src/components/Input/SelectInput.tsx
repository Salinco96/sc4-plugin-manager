import { Autocomplete, FormControl, InputLabel, MenuItem, Select, TextField } from "@mui/material"
import type { ReactNode } from "react"

export type SelectOption<T extends string> = {
  disabled?: boolean
  fixed?: boolean
  label: ReactNode
  value: T
}

export type SelectInputProps<T extends string> = {
  disabled?: boolean
  enableSearch?: boolean
  label: ReactNode
  name: string
  onChange: (value: T | undefined) => void
  options: SelectOption<T>[]
  required?: boolean
  value: T | undefined
}

export function SelectInput<T extends string>({
  disabled,
  enableSearch,
  label,
  name,
  onChange,
  options,
  required,
  value,
}: SelectInputProps<T>): JSX.Element {
  if (enableSearch) {
    return (
      <Autocomplete<SelectOption<T>, false, boolean>
        disabled={disabled}
        disableClearable={required}
        disablePortal
        fullWidth
        getOptionDisabled={isOptionDisabled}
        onChange={(_, option) => onChange(option?.value)}
        options={options}
        renderInput={inputProps => (
          <TextField {...inputProps} label={label} name={name} required={required} />
        )}
        size="small"
        value={options.find(option => option.value === value) || null}
      />
    )
  }

  return (
    <FormControl disabled={disabled} fullWidth size="small">
      <InputLabel id={`${name}-label`}>{label}</InputLabel>
      <Select<T>
        label={label}
        id={`${name}-select`}
        labelId={`${name}-label`}
        onChange={event => {
          const value = event.target.value as T | ""
          onChange(value || undefined)
        }}
        required={required}
        value={value || ""}
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

export function isOptionDisabled(option: SelectOption<string>): boolean {
  return !!option.disabled
}
