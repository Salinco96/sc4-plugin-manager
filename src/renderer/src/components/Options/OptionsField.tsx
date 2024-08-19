import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Switch,
  TextField,
} from "@mui/material"

import { OptionInfo, OptionType, OptionValue } from "@common/types"
import { isArray, isNumber, isString } from "@common/utils/types"
import { FlexBox } from "@components/FlexBox"
import { Text } from "@components/Text"

export function OptionsField({
  disabled,
  onChange,
  option,
  value,
}: {
  disabled?: boolean
  onChange: (value: OptionValue | ReadonlyArray<OptionValue>) => void
  option: OptionInfo
  value: OptionValue | ReadonlyArray<OptionValue>
}): JSX.Element | null {
  if (option.type === OptionType.BOOLEAN) {
    if (option.display === "switch") {
      return (
        <FlexBox alignItems="center" title={option.description}>
          {option.label && (
            <Text maxLines={3} sx={{ flex: 1, mr: 1 }}>
              {option.label}
            </Text>
          )}
          <Switch
            checked={value === true}
            color="primary"
            disabled={disabled}
            name={option.id}
            onClick={event => {
              const { checked } = event.target as HTMLInputElement
              if (checked !== value) {
                onChange(checked)
              }
            }}
          />
        </FlexBox>
      )
    }

    return (
      <FlexBox alignItems="center" title={option.description}>
        <Checkbox
          checked={value === true}
          color="primary"
          disabled={disabled}
          name={option.id}
          onChange={(event, checked) => {
            if (checked !== value) {
              onChange(checked)
            }
          }}
          sx={{ p: 0 }}
        />
        {option.label && (
          <Text maxLines={3} sx={{ flex: 1, ml: 1 }}>
            {option.label}
          </Text>
        )}
      </FlexBox>
    )
  }

  if (option.choices) {
    if (option.display === "checkbox") {
      if (option.multi) {
        const values = isArray(value) ? value : [value]
        const allValues = option.choices.map(choice =>
          typeof choice === "object" ? choice.value : choice,
        )
        const allChecked = allValues.every(value => values.includes(value))

        return (
          <FormControl fullWidth>
            {option.label && <FormLabel id={option.id + "-label"}>{option.label}</FormLabel>}
            {option.choices.length > 2 && (
              <FormControlLabel
                checked={allChecked}
                control={<Checkbox />}
                onChange={() => {
                  if (allChecked) {
                    onChange([])
                  } else {
                    onChange(allValues)
                  }
                }}
                label="All"
              />
            )}
            {option.choices.map(choice =>
              isNumber(choice) || isString(choice) ? (
                <FormControlLabel
                  checked={values.includes(choice)}
                  control={<Checkbox />}
                  key={choice}
                  onChange={() => {
                    if (values.includes(choice)) {
                      onChange(values.filter(value => value !== choice))
                    } else {
                      onChange([...values, choice])
                    }
                  }}
                  label={choice}
                  value={choice}
                />
              ) : (
                <FormControlLabel
                  checked={values.includes(choice.value)}
                  control={<Checkbox />}
                  key={choice.value}
                  onChange={() => {
                    if (values.includes(choice.value)) {
                      onChange(values.filter(value => value !== choice.value))
                    } else {
                      onChange([...values, choice.value])
                    }
                  }}
                  label={choice.label ?? choice.value}
                  title={choice.description}
                  value={choice.value}
                />
              ),
            )}
          </FormControl>
        )
      }

      return (
        <FormControl fullWidth>
          {option.label && <FormLabel id={option.id + "-label"}>{option.label}</FormLabel>}
          <RadioGroup
            aria-labelledby={option.id + "-label"}
            name={option.id}
            value={value}
            onChange={event => {
              const newValue = event.target.value
              if (newValue !== value) {
                onChange(newValue)
              }
            }}
          >
            {option.choices.map(choice =>
              isNumber(choice) || isString(choice) ? (
                <FormControlLabel control={<Radio />} key={choice} label={choice} value={choice} />
              ) : (
                <FormControlLabel
                  control={<Radio />}
                  key={choice.value}
                  label={choice.label ?? choice.value}
                  title={choice.description}
                  value={choice.value}
                />
              ),
            )}
          </RadioGroup>
        </FormControl>
      )
    }

    return (
      <FormControl fullWidth>
        {option.label && <InputLabel id={option.id + "-label"}>{option.label}</InputLabel>}
        <Select<OptionValue | OptionValue[]>
          disabled={disabled}
          fullWidth
          labelId={option.id + "-label"}
          label={option.label}
          multiple={option.multi}
          name={option.id}
          onChange={event => {
            const newValue = event.target.value
            if (newValue !== value) {
              onChange(newValue)
            }
          }}
          size="small"
          title={option.description}
          value={option.multi && !isArray(value) ? [value] : (value as OptionValue)}
          variant="outlined"
        >
          {option.choices.map(choice =>
            isNumber(choice) || isString(choice) ? (
              <MenuItem key={choice} value={choice}>
                {choice}
              </MenuItem>
            ) : (
              <MenuItem key={choice.value} title={choice.description} value={choice.value}>
                {choice.label ?? choice.value}
              </MenuItem>
            ),
          )}
        </Select>
      </FormControl>
    )
  }

  if (option.type === OptionType.NUMBER) {
    return (
      <TextField
        disabled={disabled}
        InputProps={{
          inputProps: {
            max: option.max,
            min: option.min ?? 0,
            step: option.step ?? 1,
          },
        }}
        label={option.label}
        name={option.id}
        onChange={event => {
          const newValue = Number.parseFloat(event.target.value)
          if (newValue !== value) {
            onChange(newValue)
          }
        }}
        size="small"
        title={option.description}
        type="number"
        value={value}
        variant="outlined"
      />
    )
  }

  console.error(`Unsupported option type ${option.type}`)
  return null
}
