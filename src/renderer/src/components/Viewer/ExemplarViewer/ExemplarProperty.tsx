import { AddCircleOutline as AddIcon, RemoveCircleOutline as RemoveIcon } from "@mui/icons-material"
import { FormHelperText, IconButton, Link } from "@mui/material"

import {
  type ExemplarProperty,
  ExemplarPropertyInfo,
  ExemplarPropertyValue,
  ExemplarValueType,
} from "@common/exemplars"
import { removeAt, replaceAt } from "@common/utils/arrays"
import { toHex } from "@common/utils/hex"
import { isArray, isBoolean, isString } from "@common/utils/types"
import { FlexBox } from "@components/FlexBox"

import { ExemplarPropertyInput } from "./ExemplarPropertyInput"
import { PropertyErrors, formatInputValue, getHexSize } from "./utils"

export interface ExemplarPropertyProps {
  errors?: PropertyErrors
  onChange: (newValue: ExemplarPropertyValue | null) => void
  original?: ExemplarPropertyValue | null
  property: ExemplarProperty
  readonly?: boolean
}

export function ExemplarProperty({
  errors,
  onChange,
  original,
  property,
  readonly,
}: ExemplarPropertyProps): JSX.Element {
  const { id, info, type, value } = property

  const idHex = toHex(id, 8, true)

  const maxLength = info?.size ?? info?.maxLength ?? 64
  const minLength = info?.size ?? info?.minLength ?? 1

  const canAdd = isArray(value) && value.length < maxLength && !readonly
  const canRemove = isArray(value) && value.length > minLength && !readonly
  const isSingleLine = !isArray(value) || value.length <= 1

  const error = isArray(errors) ? errors.find(isString) : errors

  // todo: too many large fields!
  if (isArray(value) && value.length > 8) {
    return (
      <p>
        {idHex}: {showValue(value, type, info)}
      </p>
    )
  }

  function addItem() {
    if (canAdd) {
      const itemInfo = info?.items?.at(value.length)
      const defaultValue = itemInfo?.default ?? info?.default ?? 0
      onChange([...value, defaultValue as number])
    }
  }

  return (
    <FlexBox direction="column" marginTop={2}>
      {isArray(value) ? (
        value.map((item, index) => (
          <FlexBox key={index} alignItems="center" gap={1} width="100%">
            <ExemplarPropertyInput
              error={isString(errors) || !!errors?.at(index)}
              index={index}
              name={`${idHex}-${index}`}
              onChange={newValue => onChange(replaceAt(value, index, newValue))}
              original={isArray(original) ? original.at(index) : undefined}
              property={property}
              readonly={readonly}
              value={item}
            />
            {canRemove && (
              <IconButton
                onClick={() => onChange(removeAt(value, index))}
                size="small"
                title="Remove value"
              >
                <RemoveIcon fontSize="inherit" />
              </IconButton>
            )}
            {canAdd && isSingleLine && (
              <IconButton onClick={addItem} size="small" title="Add value">
                <AddIcon fontSize="inherit" />
              </IconButton>
            )}
          </FlexBox>
        ))
      ) : (
        <ExemplarPropertyInput
          error={!!error}
          name={idHex}
          onChange={onChange}
          original={isArray(original) ? undefined : original}
          property={property}
          readonly={readonly}
          value={value}
        />
      )}
      <FlexBox>
        <FlexBox alignItems="start" flex={1}>
          <FormHelperText sx={{ marginBottom: 2 }} error={!!error}>
            {error}
            {original !== undefined && !error && (
              <>
                Original: {showValue(original, type, info)}
                {!readonly && (
                  <Link
                    component="button"
                    onClick={() => onChange(original)}
                    sx={{ paddingLeft: 0.5 }}
                    title="Reset to initial value"
                  >
                    Reset
                  </Link>
                )}
              </>
            )}
          </FormHelperText>
        </FlexBox>
        {canAdd && !isSingleLine && (
          <FlexBox alignItems="center" height={40} marginBottom={2}>
            <IconButton onClick={addItem} size="small" title="Add value">
              <AddIcon fontSize="inherit" />
            </IconButton>
          </FlexBox>
        )}
      </FlexBox>
    </FlexBox>
  )
}

function showValue(
  value: ExemplarPropertyValue | null,
  type: ExemplarValueType,
  info?: ExemplarPropertyInfo,
): string {
  if (value === null) {
    return "-"
  }

  if (isString(value)) {
    return `"${value}"`
  }

  const values = isArray(value) ? value : [value]

  return values
    .map(item => {
      if (isBoolean(item)) {
        return item ? "Yes" : "No"
      }

      const choice = info?.choices?.find(choice => choice.value === item)
      if (choice) {
        return choice.label
      }

      if (info?.display === "hex") {
        return toHex(item, getHexSize(type), true, true)
      }

      if (info?.display === "tgi") {
        return toHex(item, 8)
      }

      return formatInputValue(item, type, false)
    })
    .join(info?.display === "tgi" ? "-" : ", ")
}
