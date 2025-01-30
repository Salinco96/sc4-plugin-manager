import { RemoveCircleOutline as RemoveIcon } from "@mui/icons-material"
import { Box, ButtonGroup, IconButton, Modal } from "@mui/material"
import { fill, isArray, isString, replaceAt, toHex } from "@salinco/nice-utils"
import ColorPicker from "@uiw/react-color-sketch"
import { useEffect, useMemo, useState } from "react"

import { ExemplarDisplayType, type ExemplarProperty, ExemplarValueType } from "@common/exemplars"
import { FlexRow } from "@components/FlexBox"

import { ExemplarPropertyInput } from "./ExemplarPropertyInput"
import { type PropertyErrors, useExemplarPropertyInfo } from "./utils"

export interface ColorProps {
  alpha: boolean
  color: string
  parse: (hex: string) => number[]
}

export interface ExemplarPropertyInputGroupProps<T extends number[] | string[] | boolean[]> {
  canRemove: boolean
  errors: PropertyErrors | undefined
  groupIndex: number
  groupSize: number
  isExpandable: boolean
  isExpanded: boolean
  isFirstGroup: boolean
  isLastGroup: boolean
  name: string
  onChange: (newValues: T) => void
  onRemove: () => void
  original: T | null | undefined
  property: ExemplarProperty
  readonly: boolean
  setExpanded?: (isExpanded: boolean) => void
  showRightMargin: boolean
  value: T
}

export function ExemplarPropertyInputGroup<T extends number[] | string[] | boolean[]>({
  canRemove,
  errors,
  groupIndex,
  groupSize,
  isExpandable,
  isExpanded,
  isFirstGroup,
  isLastGroup,
  onChange,
  onRemove,
  original,
  name,
  property,
  readonly,
  setExpanded,
  showRightMargin,
  value,
}: ExemplarPropertyInputGroupProps<T>): JSX.Element {
  const { type } = property

  const info = useExemplarPropertyInfo(property.id)

  const paddedValues = useMemo(
    () => fill(groupSize, index => value.at(index) ?? null),
    [groupSize, value],
  )

  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [values, setValues] = useState(paddedValues)

  useEffect(() => {
    setValues(paddedValues)
  }, [paddedValues])

  const colorProps = useMemo<ColorProps | undefined>(() => {
    if (type === ExemplarValueType.UInt32) {
      switch (info?.display) {
        case ExemplarDisplayType.RGB:
          return {
            alpha: false,
            color: `#${toHex(Number(value.at(0)) || 0, 8).slice(-6)}`,
            parse: hex => [Number.parseInt(hex.replace("#", ""), 16)],
          }

        case ExemplarDisplayType.RGBA:
          return {
            alpha: true,
            color: `#${toHex(Number(value.at(0)) || 0, 8)}`,
            parse: hex => [Number.parseInt(hex.replace("#", ""), 16)],
          }
      }
    }

    if (type === ExemplarValueType.UInt8) {
      switch (info?.display) {
        case ExemplarDisplayType.RGB:
          return {
            alpha: false,
            color: `#${values.map(h => toHex(Number(h) || 0, 2)).join("")}`,
            parse: hex =>
              [
                hex.replace("#", "").slice(0, 2),
                hex.replace("#", "").slice(2, 4),
                hex.replace("#", "").slice(4, 6),
              ].map(h => Number.parseInt(h, 16)),
          }

        case ExemplarDisplayType.RGBA:
          return {
            alpha: true,
            color: `#${values.map(h => toHex(Number(h) || 0, 2)).join("")}`,
            parse: hex =>
              [
                hex.replace("#", "").slice(0, 2),
                hex.replace("#", "").slice(2, 4),
                hex.replace("#", "").slice(4, 6),
                hex.replace("#", "").slice(6, 8),
              ].map(h => Number.parseInt(h, 16)),
          }
      }
    }
  }, [info, type, value, values])

  return (
    <>
      {values.map((item, index, rows) => (
        <FlexRow centered fullWidth key={index} gap={1}>
          <ExemplarPropertyInput
            error={isString(errors) || !!errors?.at(index)}
            index={index}
            isExpandable={isExpandable}
            isExpanded={isExpanded}
            isFirst={isFirstGroup && index === 0}
            isLast={isLastGroup && index === rows.length - 1}
            name={`${name}-${groupIndex * groupSize + index}`}
            onChange={newValue => {
              const newValues = replaceAt(values, index, newValue)
              setValues(newValues)
              if (newValues.every(value => value !== null)) {
                onChange(newValues as T)
              }
            }}
            openColorPicker={() => setColorPickerOpen(true)}
            original={isArray(original) ? original.at(index) : undefined}
            property={property}
            readonly={readonly}
            setExpanded={setExpanded}
            value={item}
          />

          {showRightMargin && (
            <ButtonGroup component={FlexRow} width={29}>
              {canRemove && index === 0 && (
                <IconButton onClick={onRemove} size="small" title="Remove value">
                  <RemoveIcon fontSize="inherit" />
                </IconButton>
              )}
            </ButtonGroup>
          )}
        </FlexRow>
      ))}

      {colorProps && (
        <Modal open={colorPickerOpen} onClose={() => setColorPickerOpen(false)}>
          <Box
            sx={{
              backgroundColor: "white",
              borderRadius: 3,
              left: "50%",
              maxHeight: "80%",
              maxWidth: "80%",
              overflow: "hidden",
              position: "absolute",
              transform: "translate(-50%, -50%)",
              top: "50%",
              width: 600,
            }}
          >
            <Box padding={1.25} paddingBottom={0} width="100%">
              <Box
                bgcolor={colorProps.color}
                border="1px solid rgb(204, 204, 204)"
                flex={1}
                height={20}
              />
            </Box>

            <ColorPicker
              color={colorProps.color}
              disableAlpha={!colorProps.alpha}
              onChange={color => {
                const hex = colorProps.alpha ? color.hexa : color.hex
                onChange(colorProps.parse(hex) as T)
              }}
              style={{ boxShadow: "none", width: "100%" }}
            />
          </Box>
        </Modal>
      )}
    </>
  )
}
