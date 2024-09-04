import { FormControl, FormGroup } from "@mui/material"

import { OptionInfo, OptionValue, Options, Requirements, getOptionValue } from "@common/options"

import { OptionsField } from "./OptionsField"

export function OptionsFormSection({
  onChange,
  options,
  values,
  ...props
}: {
  checkCondition: (conditions: Requirements | undefined) => boolean
  disabled?: boolean
  onChange: (option: OptionInfo, value: OptionValue) => void
  options: OptionInfo[]
  values: Options
}): JSX.Element {
  return (
    <FormControl component="fieldset" fullWidth>
      <FormGroup sx={{ gap: 2 }}>
        {options.map(option => (
          <OptionsField
            {...props}
            key={option.id}
            onChange={newValue => onChange(option, newValue)}
            option={option}
            value={getOptionValue(option, values)}
          />
        ))}
      </FormGroup>
    </FormControl>
  )
}
