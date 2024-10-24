import { FormControl, FormLabel, Switch } from "@mui/material"

export interface ExemplarPropertySwitchProps {
  description?: string
  label: string
  name: string
  onChange: (newValue: boolean) => void
  readonly?: boolean
  value: boolean
}

export function ExemplarPropertySwitch({
  description,
  label,
  name,
  onChange,
  readonly,
  value,
}: ExemplarPropertySwitchProps): JSX.Element {
  return (
    <FormControl
      disabled={readonly}
      fullWidth
      sx={{ alignItems: "center", flexDirection: "row" }}
      title={description}
    >
      <FormLabel sx={{ flex: 1 }}>{label}</FormLabel>
      <Switch
        checked={!!value}
        color="primary"
        name={name}
        onChange={event => onChange(event.target.checked)}
      />
    </FormControl>
  )
}
