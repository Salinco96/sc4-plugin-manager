import { useEffect, useMemo, useRef, useState } from "react"

import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormControlLabel,
  Switch,
  Typography,
} from "@mui/material"
import { collect, isArray, parseHex, toHex } from "@salinco/nice-utils"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"

import { TGI } from "@common/dbpf"
import type { ExemplarData, ExemplarDataPatch, ExemplarPropertyValue } from "@common/exemplars"
import { FlexBox } from "@components/FlexBox"

import { Viewer } from "../Viewer"

import { useStore } from "@utils/store"
import { ExemplarProperty, type ExemplarPropertyProps } from "./ExemplarProperty"
import { ExemplarPropertySearch } from "./ExemplarPropertySearch"
import { PARENT_COHORT_ID_INFO, getDiff, getErrors } from "./utils"

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
  readonly = false,
}: ExemplarViewerProps): JSX.Element {
  const exemplarProperties = useStore(store => store.exemplarProperties)

  const [currentData, setCurrentData] = useState(data)
  const [originalData, setOriginalData] = useState(original ?? data)
  const [patchedData, setPatchedData] = useState(data)
  const [showDiffOnly, setShowDiffOnly] = useState(false)

  const selectedPropertyIdRef = useRef<number>()
  const listRef = useRef<VirtuosoHandle | null>(null)

  useEffect(() => {
    setCurrentData(data)
    setOriginalData(original ?? data)
    setPatchedData(data)
  }, [data, original])

  const diff = useMemo(() => {
    return getDiff(currentData, originalData)
  }, [currentData, originalData])

  const dirty = useMemo(() => {
    return getDiff(currentData, patchedData) !== null
  }, [currentData, patchedData])

  const errors = useMemo(() => {
    return getErrors(currentData, exemplarProperties)
  }, [currentData, exemplarProperties])

  const isPatched = original !== undefined && !!diff && !isLocal

  const fields: ExemplarPropertyProps[] = useMemo(() => {
    function getOriginalValue(propertyId: number): ExemplarPropertyValue | null | undefined {
      if (diff?.properties?.[toHex(propertyId, 8)] !== undefined) {
        return originalData?.properties[propertyId]?.value ?? null
      }
    }

    const fields: ExemplarPropertyProps[] = collect(currentData.properties, property => ({
      errors: errors?.properties?.[property.id],
      onChange(value) {
        if (value === null) {
          const { [property.id]: deleted, ...properties } = currentData.properties
          setCurrentData({ ...currentData, properties })
        } else {
          setCurrentData({
            ...currentData,
            properties: {
              ...currentData.properties,
              [property.id]: { ...property, value } as typeof property,
            },
          })
        }
      },
      property,
      original: getOriginalValue(property.id),
      readonly,
    }))

    fields.unshift({
      errors: errors?.parentCohortId,
      onChange(value) {
        if (isArray(value) && value.length === 3) {
          setCurrentData({
            ...currentData,
            parentCohortId: TGI(value[0], value[1], value[2]),
          })
        } else {
          setCurrentData({
            ...currentData,
            parentCohortId: TGI(0, 0, 0),
          })
        }
      },
      property: {
        id: PARENT_COHORT_ID_INFO.id,
        type: PARENT_COHORT_ID_INFO.type,
        value: currentData?.parentCohortId.split("-").map(parseHex),
      },
      original: diff?.parentCohortId
        ? originalData?.parentCohortId.split("-").map(parseHex)
        : undefined,
      readonly,
    })

    if (showDiffOnly && isPatched) {
      return fields.filter(field => field.original !== undefined)
    }

    return fields
  }, [currentData, diff, errors, isPatched, originalData, readonly, showDiffOnly])

  // After selecting or creating a new property, scroll to it and focus the first input
  useEffect(() => {
    const createdPropertyId = selectedPropertyIdRef.current
    if (createdPropertyId !== undefined && listRef.current) {
      selectedPropertyIdRef.current = undefined

      const index = fields.findIndex(field => field.property.id === createdPropertyId)
      if (index >= 0) {
        listRef.current.scrollToIndex({ align: "center", index })
      }

      setTimeout(() => {
        const input = document.getElementById(`${toHex(createdPropertyId, 8)}-0`)
        if (input) {
          input.focus()
          if (input instanceof HTMLInputElement) {
            input.select()
          }
        }
      }, 100)
    }
  }, [fields])

  return (
    <Viewer background="light" open={open} onClose={onClose}>
      <FlexBox direction="column" height="100%" width="100%">
        <FlexBox alignItems="center" height={60} paddingX={8}>
          <Typography variant="h6">{id}</Typography>
        </FlexBox>
        <FlexBox direction="column" flex={1} overflow="auto">
          <Virtuoso
            data={fields}
            itemContent={(index, field) => (
              <Box paddingLeft={8} paddingRight={6} width="100%">
                <ExemplarProperty {...field} />
              </Box>
            )}
            ref={listRef}
            style={{ scrollbarGutter: "stable" }}
          />
        </FlexBox>
        <FlexBox direction="column" paddingX={8} paddingY={2} gap={2}>
          <ExemplarPropertySearch
            data={data}
            id={id}
            onSelect={property => {
              selectedPropertyIdRef.current = property.id

              if (
                showDiffOnly &&
                currentData.properties[property.id] &&
                diff?.properties?.[toHex(property.id, 8)] === undefined
              ) {
                setShowDiffOnly(false)
              }

              setCurrentData({
                ...currentData,
                properties: {
                  ...currentData.properties,
                  [property.id]: property,
                },
              })
            }}
            readonly={readonly}
          />
          <FlexBox>
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
                    disabled={!diff && !dirty}
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
      </FlexBox>
    </Viewer>
  )
}
