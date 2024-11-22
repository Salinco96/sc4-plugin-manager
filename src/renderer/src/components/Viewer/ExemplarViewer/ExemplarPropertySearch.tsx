import { Autocomplete, Box, InputAdornment, TextField, createFilterOptions } from "@mui/material"
import { isString, keys, mapDefined, toHex } from "@salinco/nice-utils"
import { useMemo, useState } from "react"

import type { ExemplarData, ExemplarProperty } from "@common/exemplars"
import { FlexBox } from "@components/FlexBox"
import { useStore } from "@utils/store"
import { getDefaultValue } from "./utils"

export interface ExemplarPropertyNewProps {
  data: ExemplarData
  onSelect: (property: ExemplarProperty) => void
  readonly: boolean
}

export function ExemplarPropertySearch({
  data,
  onSelect,
  readonly,
}: ExemplarPropertyNewProps): JSX.Element {
  const exemplarProperties = useStore(store => store.exemplarProperties)

  const filterOptions = useMemo(() => {
    return createFilterOptions<{ label: string; value: number }>({
      stringify(option) {
        return `0x${toHex(option.value, 8).toUpperCase()} | ${option.label}`
      },
    })
  }, [])

  const options = useMemo(() => {
    return mapDefined(keys(exemplarProperties).map(Number), propertyId => {
      const property = data.properties[propertyId]
      if (readonly && !property) {
        return
      }

      const info = exemplarProperties[propertyId]
      if (info?.type) {
        return {
          label: info.name,
          value: propertyId,
        }
      }
    })
  }, [data, exemplarProperties, readonly])

  const [isSearching, setSearching] = useState(false)

  return (
    <Autocomplete
      autoHighlight
      blurOnSelect
      clearOnBlur
      disableClearable
      filterOptions={filterOptions}
      freeSolo={isSearching}
      fullWidth
      getOptionLabel={option => {
        if (isString(option)) {
          return option
        }

        return option.label
      }}
      handleHomeEndKeys
      onChange={(event, newValue) => {
        if (!isString(newValue)) {
          const propertyId = newValue.value
          const property = data.properties[propertyId]
          const propertyInfo = exemplarProperties[propertyId]
          if (property) {
            onSelect(property)
          } else if (propertyInfo?.type) {
            onSelect({
              id: newValue.value,
              type: propertyInfo.type,
              value: getDefaultValue(propertyInfo),
            } as ExemplarProperty)
          }
        }
      }}
      openOnFocus
      options={options}
      renderInput={inputProps => (
        <TextField
          {...inputProps}
          label={readonly ? "Search property" : "Search or add property"}
          onBlur={() => setSearching(false)}
          onFocus={() => setSearching(true)}
          placeholder="Search by name or ID"
        />
      )}
      renderOption={(optionProps, option) => (
        <Box component="li" {...optionProps} style={{ paddingLeft: 14 }} key={option.value}>
          <InputAdornment position="start" sx={{ marginLeft: 0, marginRight: 0 }}>
            <FlexBox marginRight={isSearching ? 1 : undefined} minWidth={160}>
              <span style={{ flex: 1 }}>0x{toHex(option.value, 8).toUpperCase()}</span>
              <span style={{ paddingLeft: 8, paddingRight: 8 }}>|</span>
            </FlexBox>
          </InputAdornment>
          {option.label}
        </Box>
      )}
      size="small"
      value=""
    />
  )
}
