import { useState } from "react"

import { AddCircleOutline as AddIcon, RemoveCircleOutline as RemoveIcon } from "@mui/icons-material"
import { ButtonGroup, FormHelperText, IconButton, Link } from "@mui/material"

import { type ExemplarProperty, ExemplarPropertyValue } from "@common/exemplars"
import { removeAt, replaceAt } from "@common/utils/arrays"
import { toHex } from "@common/utils/hex"
import { isArray, isString } from "@common/utils/types"
import { FlexBox } from "@components/FlexBox"

import { CurveEditor } from "./CurveEditor"
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
}: ExemplarPropertyProps): JSX.Element {
  const { id, info, value } = property

  const idHex = toHex(id, 8, true)

  const groupSize = info?.size && info.repeat ? info.size : 1
  const maxLength = info?.size && !info.repeat ? info.size : info?.maxLength ?? groupSize * 16
  const minLength = info?.size && !info.repeat ? info.size : info?.minLength ?? 0

  const canAdd = isArray(value) && value.length > 0 && value.length < maxLength && !readonly
  const canRemove = isArray(value) && value.length > minLength && !readonly

  const error = isArray(errors) ? errors.find(isString) : errors

  const isExpandable = isArray(value) && value.length > 5

  const [isExpanded, setExpanded] = useState(!isExpandable)

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
        (value.length ? value : Array(groupSize).fill(null))
          .slice(0, isExpanded || !isExpandable ? undefined : groupSize)
          .map((item, index, rows) => (
            <FlexBox key={index} alignItems="center" gap={1} width="100%">
              <ExemplarPropertyInput
                error={isString(errors) || !!errors?.at(index)}
                index={index}
                isExpandable={isExpandable}
                isExpanded={isExpanded}
                isFirst={index === 0}
                isLast={index === rows.length - 1}
                name={`${idHex}-${index}`}
                onChange={newValue => onChange(replaceAt(value, index, newValue))}
                original={isArray(original) ? original.at(index) : undefined}
                property={property}
                readonly={readonly}
                setExpanded={setExpanded}
                value={item}
              />
              {(canAdd || canRemove) && isExpanded && (
                <ButtonGroup component={FlexBox} width={29}>
                  {canRemove &&
                    (info?.repeat
                      ? index % groupSize === 0
                      : index >= Math.min(info?.items?.length ?? 0, minLength)) && (
                      <IconButton
                        onClick={() => removeItem(index)}
                        size="small"
                        title="Remove value"
                      >
                        <RemoveIcon fontSize="inherit" />
                      </IconButton>
                    )}
                </ButtonGroup>
              )}
            </FlexBox>
          ))
      ) : (
        <ExemplarPropertyInput
          error={!!error}
          isExpandable={isExpandable}
          isExpanded={isExpanded}
          isFirst
          isLast
          name={idHex}
          onChange={onChange}
          original={isArray(original) ? undefined : original}
          property={property}
          readonly={readonly}
          setExpanded={setExpanded}
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
        {canAdd && isExpanded && (
          <FlexBox alignItems="center" height={40} marginBottom={2}>
            <IconButton onClick={addItem} size="small" title="Add value">
              <AddIcon fontSize="inherit" />
            </IconButton>
          </FlexBox>
        )}
      </FlexBox>
      {isArray(value) && info?.size === 2 && info.repeat && (
        <CurveEditor
          onChange={onChange}
          original={isArray(original) ? original : undefined}
          property={property}
          value={value}
        />
      )}
    </FlexBox>
  )
}
