import { useEffect, useMemo, useState } from "react"

import {
  Button,
  ButtonGroup,
  FormControl,
  FormControlLabel,
  Switch,
  Typography,
} from "@mui/material"

import { TGI } from "@common/dbpf"
import {
  ExemplarData,
  ExemplarDataPatch,
  ExemplarPropertyValue,
  ExemplarValueType,
} from "@common/exemplars"
import { readHex, toHex } from "@common/utils/hex"
import { values } from "@common/utils/objects"
import { isArray } from "@common/utils/types"
import { FlexBox } from "@components/FlexBox"

import { Viewer } from "../Viewer"

import { ExemplarProperty } from "./ExemplarProperty"
import { getDiff, getErrors } from "./utils"

export interface ExemplarViewerProps {
  data: ExemplarData
  id: TGI
  isLocal: boolean
  onClose: () => void
  onPatch: (data: ExemplarDataPatch | null) => void
  open: boolean
  original?: ExemplarData
  readonly?: boolean
}

export function ExemplarViewer({
  data,
  id,
  isLocal,
  open,
  onClose,
  onPatch,
  original,
  readonly,
}: ExemplarViewerProps): JSX.Element {
  const [currentData, setCurrentData] = useState(data)
  const [originalData, setOriginalData] = useState(original ?? data)
  const [patchedData, setPatchedData] = useState(data)
  const [showDiffOnly, setShowDiffOnly] = useState(false)

  useEffect(() => {
    setCurrentData(data)
    setOriginalData(original ?? data)
    setPatchedData(patchedData)
  }, [data, original])

  const diff = useMemo(() => getDiff(currentData, originalData), [currentData, originalData])
  const dirty = useMemo(() => !!getDiff(currentData, patchedData), [currentData, patchedData])
  const errors = useMemo(() => getErrors(currentData), [currentData])

  const isPatched = original !== undefined && !!diff && !isLocal

  function getOriginalValue(propertyId: number): ExemplarPropertyValue | null | undefined {
    if (diff?.properties?.[toHex(propertyId, 8)] !== undefined) {
      return originalData?.properties[propertyId]?.value ?? null
    }
  }

  return (
    <Viewer background="light" open={open} onClose={onClose}>
      <FlexBox direction="column" height="100%" width="100%">
        <FlexBox alignItems="center" height={60} paddingX={8}>
          <Typography variant="h6">{id}</Typography>
        </FlexBox>
        <FlexBox direction="column" flex={1} overflow="auto">
          <FlexBox direction="column" paddingX={8}>
            {(!showDiffOnly || !isPatched || diff?.parentCohortId) && (
              <ExemplarProperty
                errors={errors?.parentCohortId}
                onChange={newValue => {
                  if (isArray(newValue) && newValue.length === 3) {
                    setCurrentData({
                      ...currentData,
                      parentCohortId: TGI(newValue[0], newValue[1], newValue[2]),
                    })
                  } else {
                    setCurrentData({
                      ...currentData,
                      parentCohortId: TGI(0, 0, 0),
                    })
                  }
                }}
                property={{
                  id: 0,
                  info: {
                    display: "tgi",
                    id: 0,
                    name: "Parent Cohort ID",
                    size: 3,
                    type: ExemplarValueType.UInt32,
                  },
                  type: ExemplarValueType.UInt32,
                  value: currentData?.parentCohortId.split("-").map(readHex),
                }}
                original={
                  diff?.parentCohortId
                    ? originalData?.parentCohortId.split("-").map(readHex)
                    : undefined
                }
                readonly={readonly}
              />
            )}
            {values(currentData.properties).map(property => {
              const original = getOriginalValue(property.id)

              if (showDiffOnly && isPatched && original === undefined) {
                return null
              }

              return (
                <ExemplarProperty
                  errors={errors?.properties?.[property.id]}
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
                          } as typeof property,
                        },
                      })
                    }
                  }}
                  property={property}
                  original={original}
                  readonly={readonly}
                />
              )
            })}
          </FlexBox>
        </FlexBox>
        <FlexBox paddingX={8} paddingY={2}>
          <FlexBox alignItems="center" flex={1}>
            {isPatched && (
              <FormControl>
                <FormControlLabel
                  checked={showDiffOnly}
                  control={<Switch color="primary" />}
                  label="Show only changed properties"
                  onChange={() => setShowDiffOnly(!showDiffOnly)}
                />
              </FormControl>
            )}
          </FlexBox>
          {!readonly && (
            <ButtonGroup>
              <Button
                disabled={!dirty || !!errors}
                onClick={() => {
                  setPatchedData(currentData)
                  onPatch(diff)
                }}
                title="Apply all changes"
                variant="outlined"
              >
                Apply
              </Button>
              {!isLocal && (
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
              )}
            </ButtonGroup>
          )}
        </FlexBox>
      </FlexBox>
    </Viewer>
  )
}
