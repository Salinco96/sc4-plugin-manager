import { FormControl, FormGroup } from "@mui/material"

import { getOptionValue } from "@common/packages"
import { OptionInfo, OptionValue, Options } from "@common/types"

import { OptionsField } from "./OptionsField"

export function OptionsFormSection({
  onChange,
  options,
  values,
  ...props
}: {
  disabled?: boolean
  onChange: (option: OptionInfo, value: OptionValue | ReadonlyArray<OptionValue>) => void
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
