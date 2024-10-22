import { useEffect, useMemo, useState } from "react"

import { Box, Button, ButtonGroup, List, ListItem, TextField } from "@mui/material"

import {
  ExemplarData,
  ExemplarDataPatch,
  type ExemplarProperty,
  ExemplarPropertyValue,
  ExemplarValueType,
} from "@common/exemplars"
import { isEqual, removeAt, replaceAt } from "@common/utils/arrays"
import { toHex } from "@common/utils/hex"
import { values } from "@common/utils/objects"
import { isArray } from "@common/utils/types"

import { Viewer } from "./Viewer"

export interface ExemplarViewerProps {
  data: ExemplarData
  onClose: () => void
  onPatch: (data: ExemplarDataPatch | null) => void
  open: boolean
  original?: ExemplarData
  readonly?: boolean
}

const InputProps: {
  [type in ExemplarValueType]: {
    max?: number
    min?: number
    step?: number
    type?: "number"
  }
} = {
  [ExemplarValueType.UInt8]: {
    max: 2 ** 8 - 1,
    min: 0,
    step: 1,
    type: "number",
  },
  [ExemplarValueType.UInt16]: {
    max: 2 ** 16 - 1,
    min: 0,
    step: 1,
    type: "number",
  },
  [ExemplarValueType.UInt32]: {
    max: 2 ** 32 - 1,
    min: 0,
    step: 1,
    type: "number",
  },
  [ExemplarValueType.SInt32]: {
    max: 2 ** 32 / 2,
    min: -(2 ** 32 / 2 + 1),
    step: 1,
    type: "number",
  },
  [ExemplarValueType.SInt64]: {
    step: 1,
    type: "number",
  },
  [ExemplarValueType.Float32]: {
    step: 0.01,
    type: "number",
  },
  [ExemplarValueType.Bool]: {},
  [ExemplarValueType.String]: {},
}

export function ExemplarProperty({
  id,
  info,
  onChange,
  original,
  readonly,
  type,
  value,
}: ExemplarProperty & {
  onChange: (newValue: ExemplarPropertyValue | null) => void
  original?: ExemplarPropertyValue | null
  readonly?: boolean
}): JSX.Element {
  const idLabel = toHex(id, 8, true)
  const typeLabel = ExemplarValueType[type]

  const label = info ? `${info.name} (${idLabel}) - ${typeLabel}` : `${idLabel} - ${typeLabel}`
  const inputProps = InputProps[type]

  if (isArray(value)) {
    if (value.length > 6)
      return (
        <p>
          {idLabel}: {JSON.stringify(value, undefined, 2)}
        </p>
      )
    return (
      <ListItem sx={{ display: "flex", flexDirection: "column" }}>
        {value.map((item, index) => (
          <Box key={index} sx={{ display: "flex" }}>
            <TextField
              InputProps={{ inputProps }}
              disabled={readonly}
              helperText={
                index !== value.length - 1 || original === undefined ? undefined : (
                  <Box sx={{ display: "flex" }}>
                    Original: {JSON.stringify(original)}
                    {!readonly && (
                      <Button
                        onClick={() => {
                          onChange(original)
                        }}
                        variant="outlined"
                      >
                        Reset
                      </Button>
                    )}
                  </Box>
                )
              }
              label={index === 0 ? label : undefined}
              name={`${idLabel}-${index}`}
              onChange={event => {
                const newValue =
                  inputProps.step === 1
                    ? Number.parseInt(event.target.value, 10)
                    : Number.parseFloat(event.target.value)

                onChange(replaceAt(value as number[], index, newValue))
              }}
              size="small"
              title={info?.desc}
              type={inputProps.type}
              value={item}
              variant="outlined"
            />
            {value.length > 1 && !readonly && (
              <Button
                onClick={() => {
                  onChange(removeAt(value as number[], index))
                }}
                variant="outlined"
              >
                -
              </Button>
            )}
          </Box>
        ))}
        {!readonly && (
          <ButtonGroup>
            <Button
              onClick={() => {
                onChange([...(value as number[]), 0])
              }}
              variant="outlined"
            >
              +
            </Button>
          </ButtonGroup>
        )}
      </ListItem>
    )
  }

  return (
    <ListItem sx={{ display: "flex", flexDirection: "column" }}>
      <TextField
        InputProps={{ inputProps }}
        disabled={readonly}
        helperText={
          original === undefined ? undefined : (
            <Box sx={{ display: "flex" }}>
              Original: {JSON.stringify(original)}
              {!readonly && (
                <Button
                  onClick={() => {
                    onChange(original)
                  }}
                  variant="outlined"
                >
                  Reset
                </Button>
              )}
            </Box>
          )
        }
        label={label}
        name={idLabel}
        onChange={event => {
          const newValue =
            inputProps.type === "number"
              ? inputProps.step === 1
                ? Number.parseInt(event.target.value, 10)
                : Number.parseFloat(event.target.value)
              : event.target.value

          onChange(newValue)
        }}
        size="small"
        title={info?.desc}
        type={inputProps.type}
        value={value}
        variant="outlined"
      />
    </ListItem>
  )
}

export function ExemplarViewer({
  data,
  open,
  onClose,
  onPatch,
  original,
  readonly,
}: ExemplarViewerProps): JSX.Element {
  const [currentData, setCurrentData] = useState(data)
  const [originalData, setOriginalData] = useState(original ?? data)
  const [patchedData, setPatchedData] = useState(data)

  useEffect(() => {
    setCurrentData(data)
    setOriginalData(original ?? data)
    setPatchedData(patchedData)
  }, [data, original])

  const diff = useMemo(() => getDiff(currentData, originalData), [currentData, originalData])

  const dirty = useMemo(() => !!getDiff(currentData, patchedData), [currentData, patchedData])

  return (
    <Viewer open={open} onClose={onClose}>
      <Box
        sx={{
          backgroundColor: "white",
          color: "black",
          height: "100%",
          paddingX: 8,
          paddingY: 3,
          width: "100%",
        }}
      >
        <Box sx={{ height: "100%", overflow: "auto", width: "100%" }}>
          <pre>Parent Cohort ID: {currentData.parentCohortId}</pre>
          <List>
            {values(currentData.properties).map(property => (
              <ExemplarProperty
                {...property}
                key={property.id}
                onChange={newValue => {
                  if (newValue === null) {
                    const { [property.id]: deleted, ...properties } = currentData.properties
                    setCurrentData({
                      ...currentData,
                      properties,
                    })
                  } else {
                    setCurrentData({
                      ...currentData,
                      properties: {
                        ...currentData.properties,
                        [property.id]: {
                          ...property,
                          value: newValue,
                        },
                      },
                    })
                  }
                }}
                original={
                  diff?.properties?.[property.id] !== undefined
                    ? originalData?.properties[property.id]?.value ?? null
                    : undefined
                }
                readonly={readonly}
              />
            ))}
          </List>
        </Box>
        {!readonly && (
          <ButtonGroup>
            <Button
              disabled={!dirty}
              onClick={() => {
                setPatchedData(currentData)
                onPatch(diff)
              }}
              title="Apply all changes"
              variant="outlined"
            >
              Apply
            </Button>
            <Button
              color="error"
              disabled={!diff}
              onClick={() => {
                setCurrentData(originalData)
                setPatchedData(originalData)
                onPatch(null)
              }}
              title="Reset all properties to their initial value"
              variant="outlined"
            >
              Reset
            </Button>
          </ButtonGroup>
        )}
      </Box>
    </Viewer>
  )
}

function getDiff(currentData: ExemplarData, originalData: ExemplarData): ExemplarDataPatch | null {
  if (currentData === originalData) {
    return null
  }

  let diff: ExemplarDataPatch | null = null

  if (currentData.parentCohortId !== originalData.parentCohortId) {
    diff ??= {}
    diff.parentCohortId = currentData.parentCohortId
  }

  for (const propertyId in originalData.properties) {
    const currentValue = currentData.properties[propertyId]?.value ?? null
    const originalValue = originalData.properties[propertyId]?.value ?? null
    if (!isEqual(currentValue, originalValue)) {
      diff ??= {}
      diff.properties ??= {}
      diff.properties[toHex(Number(propertyId), 8)] = currentValue
    }
  }

  return diff
}
