import { Checkbox, FormControl, FormLabel, Switch } from "@mui/material"
import type { ReactNode } from "react"

export type BooleanInputProps = {
  description?: string
  disabled?: boolean
  label: ReactNode
  name: string
  onChange: (value: boolean) => void
  position?: "start" | "end"
  style?: "checkbox" | "switch"
  value: boolean
}

export function BooleanInput({
  description,
  disabled,
  label,
  name,
  onChange,
  position = "end",
  style = "checkbox",
  value,
}: BooleanInputProps): JSX.Element {
  const InputComponent = style === "switch" ? Switch : Checkbox

  return (
    <FormControl
      disabled={disabled}
      fullWidth
      sx={{ alignItems: "center", flexDirection: "row" }}
      title={description}
    >
      {position === "start" && (
        <InputComponent
          checked={!!value}
          color="primary"
          name={name}
          onChange={event => onChange(event.target.checked)}
        />
      )}
      <FormLabel sx={{ flex: 1 }}>{label}</FormLabel>
      {position === "end" && (
        <InputComponent
          checked={!!value}
          color="primary"
          name={name}
          onChange={event => onChange(event.target.checked)}
          sx={{ mr: "-9px" }}
        />
      )}
    </FormControl>
  )
}
