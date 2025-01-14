import { AddCircleOutline as AddIcon } from "@mui/icons-material"
import { IconButton } from "@mui/material"
import { fill, isArray, isString, splice } from "@salinco/nice-utils"
import { useState } from "react"

import type { ExemplarProperty, ExemplarPropertyValue } from "@common/exemplars"
import { FlexCol, FlexRow } from "@components/FlexBox"

import { CurveEditor } from "./CurveEditor"
import { ExemplarPropertyHelperText } from "./ExemplarPropertyHelperText"
import { ExemplarPropertyInputGroup } from "./ExemplarPropertyInputGroup"
import { type PropertyErrors, getItemInfo, useExemplarPropertyInfo } from "./utils"

export interface ExemplarPropertyArrayProps {
  errors: PropertyErrors | undefined
  onChange: (newValue: ExemplarPropertyValue | null) => void
  original: number[] | null | undefined
  name: string
  property: ExemplarProperty
  readonly: boolean
  value: number[]
}

export function ExemplarPropertyArray({
  errors,
  name,
  onChange,
  original,
  property,
  readonly,
  value,
}: ExemplarPropertyArrayProps): JSX.Element {
  const info = useExemplarPropertyInfo(property.id)

  const groupSize = info?.size && info.repeat ? info.size : info?.items ? value.length : 1
  const maxLength = info?.size && !info.repeat ? info.size : (info?.maxLength ?? groupSize * 16)
  const minLength = info?.size && !info.repeat ? info.size : (info?.minLength ?? 0)
  const groupCount = Math.max(Math.ceil(value.length / groupSize), 1)

  const canAdd = value.length > 0 && value.length + groupSize <= maxLength && !readonly
  const canRemove = value.length - groupSize >= minLength && !readonly
  const isExpandable = value.length > 5

  const showCurveEditor = groupSize === 2 && !info?.items?.at(0)?.choices

  const error = isArray(errors) ? errors.find(isString) : errors

  const [isExpanded, setExpanded] = useState(!isExpandable)

  const visibleGroupCount = isExpanded || !isExpandable ? groupCount : 1

  function addGroup() {
    if (canAdd) {
      const defaultValues = fill(groupSize, index => {
        const itemInfo = getItemInfo(info, value.length + index)
        return Number(itemInfo?.default ?? 0)
      })

      onChange(value.concat(defaultValues))
    }
  }

  return (
    <FlexCol my={2}>
      {fill(visibleGroupCount, groupIndex => (
        <ExemplarPropertyInputGroup<number[]>
          canRemove={canRemove && (!!info?.repeat || groupIndex >= minLength)}
          errors={
            isString(errors)
              ? errors
              : errors?.slice(groupIndex * groupSize, groupIndex * groupSize + groupSize)
          }
          groupIndex={groupIndex}
          groupSize={groupSize}
          isExpandable={isExpandable}
          isExpanded={isExpanded}
          isFirstGroup={groupIndex === 0}
          isLastGroup={groupIndex === visibleGroupCount - 1}
          key={groupIndex}
          name={name}
          onChange={newValues => {
            onChange(splice(value, groupIndex * groupSize, groupSize, ...newValues))
          }}
          onRemove={() => {
            onChange(splice(value, groupIndex * groupSize, groupSize))
          }}
          original={
            original === undefined
              ? undefined
              : (original?.slice(groupIndex * groupSize, groupIndex * groupSize + groupSize) ??
                null)
          }
          property={property}
          readonly={readonly}
          setExpanded={setExpanded}
          showRightMargin={isExpanded && (canAdd || canRemove)}
          value={value.slice(groupIndex * groupSize, groupIndex * groupSize + groupSize)}
        />
      ))}

      <FlexRow>
        <FlexRow alignItems="start" flex={1}>
          <ExemplarPropertyHelperText
            error={error}
            onChange={onChange}
            original={original}
            property={property}
            readonly={readonly}
          />
        </FlexRow>

        {canAdd && isExpanded && (
          <FlexRow centered height={40} mb={2}>
            <IconButton onClick={addGroup} size="small" title="Add value">
              <AddIcon fontSize="inherit" />
            </IconButton>
          </FlexRow>
        )}
      </FlexRow>

      {showCurveEditor && (
        <CurveEditor
          onChange={onChange}
          original={original}
          property={property}
          readonly={readonly}
          value={value}
        />
      )}
    </FlexCol>
  )
}
