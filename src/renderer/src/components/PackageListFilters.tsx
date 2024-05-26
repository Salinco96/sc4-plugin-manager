import CheckBoxIcon from "@mui/icons-material/CheckBox"
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank"
import ClearIcon from "@mui/icons-material/Clear"
import {
  Autocomplete,
  Checkbox,
  IconButton,
  InputAdornment,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material"
import Box from "@mui/material/Box"

import LocalIcon from "@mui/icons-material/FileDownloadOff"
import EnabledIcon from "@mui/icons-material/FileDownloadDone"
import DependenciesIcon from "@mui/icons-material/ViewInAr"
import DownloadedIcon from "@mui/icons-material/Download"
import IncompatibleIcon from "@mui/icons-material/DoDisturb"

import { PackageCategory, PackageState } from "@common/types"
import { useStore, useStoreActions } from "@renderer/utils/store"

export function PackageListFilters(): JSX.Element {
  const actions = useStoreActions()
  const packageFilters = useStore(store => store.packageFilters)

  return (
    <Box sx={{ display: "flex", gap: 2, padding: 2, justifyContent: "start" }}>
      <ToggleButtonGroup
        value={packageFilters.state}
        exclusive
        onChange={(_, value) => actions.setPackageFilters({ state: value ?? null })}
        size="small"
      >
        <Tooltip placement="bottom" title="Show only enabled packages">
          <ToggleButton value={PackageState.ENABLED}>
            <EnabledIcon />
          </ToggleButton>
        </Tooltip>
        <Tooltip placement="bottom" title="Show only installed packages">
          <ToggleButton value={PackageState.INSTALLED}>
            <DownloadedIcon />
          </ToggleButton>
        </Tooltip>
        <Tooltip placement="bottom" title="Show only local packages">
          <ToggleButton value={PackageState.LOCAL}>
            <LocalIcon />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
      <ToggleButtonGroup
        disabled={packageFilters.onlyErrors || packageFilters.onlyUpdates}
        value={
          packageFilters.onlyErrors || packageFilters.onlyUpdates
            ? []
            : [
                packageFilters.dependencies && "dependencies",
                packageFilters.incompatible && "incompatible",
              ].filter(Boolean)
        }
        onChange={(_, values) => {
          actions.setPackageFilters({
            dependencies: values.includes("dependencies"),
            incompatible: values.includes("incompatible"),
          })
        }}
        size="small"
      >
        <Tooltip
          placement="bottom"
          title={
            packageFilters.incompatible
              ? "Hide incompatible packages"
              : "Show incompatible packages"
          }
        >
          <ToggleButton value="incompatible">
            <IncompatibleIcon />
          </ToggleButton>
        </Tooltip>
        <Tooltip
          placement="bottom"
          title={packageFilters.dependencies ? "Hide dependencies" : "Show dependencies"}
        >
          <ToggleButton value="dependencies">
            <DependenciesIcon />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
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
        renderInput={props => <TextField {...props} label="Categories" />}
        renderOption={(props, option, { selected }) => (
          <li key={option} {...props}>
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
    </Box>
  )
}
