import CheckBoxIcon from "@mui/icons-material/CheckBox"
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank"
import ClearIcon from "@mui/icons-material/Clear"
import { Autocomplete, Checkbox, IconButton, InputAdornment, TextField } from "@mui/material"
import Box from "@mui/material/Box"

import { PackageCategory, PackageState } from "@common/types"
import { useStore, useStoreActions } from "@renderer/utils/store"

export function PackageListFilters(): JSX.Element {
  const actions = useStoreActions()
  const packageFilters = useStore(store => store.packageFilters)

  return (
    <Box sx={{ display: "flex", gap: 2, padding: 2 }}>
      <TextField
        InputProps={{
          endAdornment: packageFilters.search.trim() ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => actions.setPackageFilters({ search: "" })}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
          sx: { paddingRight: 1 },
          title: "Clear",
        }}
        onChange={event => actions.setPackageFilters({ search: event.target.value })}
        label="Search"
        size="small"
        sx={{ flex: 1 }}
        value={packageFilters.search}
      />
      <Autocomplete<string, true>
        disableCloseOnSelect
        disablePortal
        limitTags={2}
        multiple
        onChange={(_, categories) => {
          actions.setPackageFilters({ categories: categories as PackageCategory[] })
        }}
        options={Object.values(PackageCategory)}
        size="small"
        sx={{ flex: 1 }}
        renderInput={props => <TextField {...props} label="Category" />}
        renderOption={(props, option, { selected }) => (
          <li {...props}>
            <Checkbox
              icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
              checkedIcon={<CheckBoxIcon fontSize="small" />}
              sx={{ marginRight: 1 }}
              checked={selected}
            />
            {option}
          </li>
        )}
        value={packageFilters.categories}
      />
      <Autocomplete<string, true>
        disableCloseOnSelect
        disablePortal
        limitTags={2}
        multiple
        onChange={(_, states) => {
          actions.setPackageFilters({ states: states as PackageState[] })
        }}
        options={Object.values(PackageState)}
        size="small"
        sx={{ flex: 1 }}
        renderInput={props => <TextField {...props} label="State" />}
        renderOption={(props, option, { selected }) => (
          <li {...props}>
            <Checkbox
              icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
              checkedIcon={<CheckBoxIcon fontSize="small" />}
              sx={{ marginRight: 1 }}
              checked={selected}
            />
            {option}
          </li>
        )}
        value={packageFilters.states}
      />
    </Box>
  )
}
