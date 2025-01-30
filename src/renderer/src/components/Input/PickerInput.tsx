import {
  FormControl,
  FormLabel,
  ToggleButton,
  ToggleButtonGroup,
  type ToggleButtonProps,
} from "@mui/material"
import type { ComponentType, ReactNode } from "react"

export type PickerOption<T extends string> = {
  color?: ToggleButtonProps["color"]
  icon: ComponentType<{ fontSize?: "inherit" }>
  description: string
  disabled?: boolean
  value: T
}

export type PickerInputValue<
  Value extends string,
  Multi extends boolean = false,
  Required extends boolean = false,
> = (Multi extends true ? Value[] : Value) | (Required extends true ? never : undefined)

export type PickerInputProps<
  Value extends string,
  Multi extends boolean = false,
  Required extends boolean = false,
> = {
  description: string
  disabled?: boolean
  label: ReactNode
  multiple?: Multi
  name: string
  onChange: (value: PickerInputValue<Value, Multi, Required>) => void
  options: PickerOption<Value>[]
  required?: Required
  value: PickerInputValue<Value, Multi, Required>
}

export function PickerInput<
  Value extends string,
  Multi extends boolean = false,
  Required extends boolean = false,
>({
  description,
  disabled,
  label,
  multiple,
  onChange,
  options,
  required,
  value,
}: PickerInputProps<Value, Multi, Required>): JSX.Element {
  return (
    <FormControl
      disabled={disabled}
      fullWidth
      sx={{ alignItems: "center", flexDirection: "row" }}
      required={required}
      title={description}
    >
      <FormLabel sx={{ flex: 1 }}>{label}</FormLabel>

      <ToggleButtonGroup
        exclusive={!multiple}
        onChange={(_event, newValue: Value[] | Value | null) => {
          const value: PickerInputValue<Value, boolean, boolean> = multiple
            ? Array.isArray(newValue)
              ? newValue.length
                ? newValue
                : undefined
              : newValue
                ? [newValue]
                : undefined
            : newValue || undefined

          onChange(value as PickerInputValue<Value, Multi, Required>)
        }}
        size="small"
        value={value || (multiple ? [] : null)}
      >
        {options.map(({ icon: IconComponent, ...option }) => {
          const isOnlySelected = Array.isArray(value)
            ? value.length === 1 && value[0] === option.value
            : value === option.value

          return (
            <ToggleButton
              aria-label={option.description}
              color={option.color}
              disabled={disabled || option.disabled || (required && isOnlySelected)}
              key={option.value}
              value={option.value}
              title={option.description}
            >
              <IconComponent />
            </ToggleButton>
          )
        })}
      </ToggleButtonGroup>
    </FormControl>
  )
}
