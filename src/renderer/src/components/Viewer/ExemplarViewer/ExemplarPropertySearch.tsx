import { useMemo, useState } from "react"

import { Autocomplete, Box, InputAdornment, TextField, createFilterOptions } from "@mui/material"

import type { ExemplarData, ExemplarProperty } from "@common/exemplars"
import { mapDefined } from "@common/utils/arrays"
import { toHex } from "@common/utils/hex"
import { keys } from "@common/utils/objects"
import { isString } from "@common/utils/types"
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
        return `${toHex(option.value, 8, true)} | ${option.label}`
      },
    })
  }, [])

  const options = useMemo(() => {
    return mapDefined(keys(exemplarProperties).map(Number), propertyId => {
      const property = data.properties[propertyId]
      if (readonly && !property) {
        return
      }

      const info = property?.info ?? exemplarProperties[propertyId]
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
          const info = property?.info ?? exemplarProperties[propertyId]
          if (property) {
            onSelect(property)
          } else if (info?.type) {
            onSelect({
              id: newValue.value,
              info,
              type: info.type,
              value: getDefaultValue(info),
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
              <span style={{ flex: 1 }}>{toHex(option.value, 8, true, true)}</span>
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
