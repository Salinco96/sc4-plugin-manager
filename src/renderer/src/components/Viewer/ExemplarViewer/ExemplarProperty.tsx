import { AddCircleOutline as AddIcon, RemoveCircleOutline as RemoveIcon } from "@mui/icons-material"
import { ButtonGroup, FormHelperText, IconButton, Link } from "@mui/material"

import { type ExemplarProperty, ExemplarPropertyValue } from "@common/exemplars"
import { removeAt, replaceAt } from "@common/utils/arrays"
import { toHex } from "@common/utils/hex"
import { isArray, isString } from "@common/utils/types"
import { FlexBox } from "@components/FlexBox"

import { ExemplarPropertyInput } from "./ExemplarPropertyInput"
import { PropertyErrors, formatValue, getItemInfo } from "./utils"

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
}: ExemplarPropertyProps): JSX.Element | null {
  const { id, info, value } = property

  const idHex = toHex(id, 8, true)

  const groupSize = info?.size && info.repeat ? info.size : 1
  const maxLength = info?.size && !info.repeat ? info.size : info?.maxLength ?? groupSize * 16
  const minLength = info?.size && !info.repeat ? info.size : info?.minLength ?? 0

  const canAdd = isArray(value) && value.length > 0 && value.length < maxLength && !readonly
  const canRemove = isArray(value) && value.length > minLength && !readonly

  const error = isArray(errors) ? errors.find(isString) : errors

  // todo: too many large fields!
  if (id >= 0x88edc901 && id <= 0x88edcdff) {
    return (
      <p>
        {info?.name} - {idHex}: {formatValue(value, property)}
      </p>
    )
  }

  function addItem() {
    if (canAdd) {
      const defaultValues = Array.from({ length: groupSize }, (unused, index) => {
        const itemInfo = getItemInfo(property, value.length + index)
        return Number(itemInfo?.default ?? info?.default ?? 0)
      })

      onChange(value.concat(defaultValues))
    }
  }

  function removeItem(index: number) {
    if (canRemove) {
      onChange(removeAt(value, index, groupSize))
    }
  }

  return (
    <FlexBox direction="column" marginTop={2}>
      {isArray(value) ? (
        (value.length ? value : Array(groupSize).fill(null)).map((item, index) => (
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
            {(canAdd || canRemove) && (
              <ButtonGroup component={FlexBox} width={29}>
                {canRemove && index % groupSize === 0 && (
                  <IconButton onClick={() => removeItem(index)} size="small" title="Remove value">
                    <RemoveIcon fontSize="inherit" />
                  </IconButton>
                )}
                {canAdd && !canRemove && index % groupSize === 0 && (
                  <IconButton onClick={addItem} size="small" title="Add value">
                    <AddIcon fontSize="inherit" />
                  </IconButton>
                )}
              </ButtonGroup>
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
                Original: {formatValue(original, property)}
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
        {canAdd && canRemove && (
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
