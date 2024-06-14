import { useMemo } from "react"

import {
  DoDisturb as IncompatibleIcon,
  Download as DownloadedIcon,
  FileDownloadDone as EnabledIcon,
  FileDownloadOff as LocalIcon,
  Science as ExperimentalIcon,
  ViewInAr as DependenciesIcon,
} from "@mui/icons-material"
import {
  Autocomplete,
  Box,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material"

import { PackageCategory, PackageState } from "@common/types"
import { useAuthors, usePackageFilters, useStoreActions } from "@utils/store"

import { TagType, createTags, getTagLabel, isValidTag } from "./utils"

export function PackageListFilters(): JSX.Element {
  const actions = useStoreActions()

  const authors = useAuthors()
  const packageFilters = usePackageFilters()

  const categories: string[] = useMemo(() => {
    // TODO: More categories, filter by other tags, filter by authors
    return Object.values(PackageCategory).sort()
  }, [])

  const options: string[] = useMemo(() => {
    const lastWord = packageFilters.search.match(/\s*,?\s*(\w+)\s*$/)?.[1]
    if (!lastWord) {
      return []
    }

    const pattern = RegExp("\\b" + lastWord, "i")

    return [
      ...createTags(
        TagType.AUTHOR,
        authors.filter(author => pattern.test(author)),
      ),
      ...createTags(
        TagType.CATEGORY,
        categories.filter(category => pattern.test(category)),
      ),
    ].filter(tag => !packageFilters.tags.includes(tag))
  }, [authors, categories, packageFilters])

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
                packageFilters.experimental && "experimental",
                packageFilters.incompatible && "incompatible",
              ].filter(Boolean)
        }
        onChange={(_, values) => {
          actions.setPackageFilters({
            dependencies: values.includes("dependencies"),
            experimental: values.includes("experimental"),
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
          title={
            packageFilters.incompatible
              ? "Hide experimental packages"
              : "Show experimental packages"
          }
        >
          <ToggleButton value="experimental">
            <ExperimentalIcon />
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
      <Autocomplete<string, true, false, true>
        disableCloseOnSelect
        disablePortal
        // We do our own filtering
        filterOptions={options => options}
        freeSolo
        getOptionLabel={getTagLabel}
        inputValue={packageFilters.search}
        limitTags={4}
        multiple
        onChange={(_, tags, reason) => {
          const validTags = tags.filter(isValidTag)

          if (reason === "selectOption" && tags.length === validTags.length) {
            actions.setPackageFilters({
              tags: validTags,
              search: packageFilters.search.replace(/\s*,?\s*(\w+)\s*$/, ""),
            })
          } else {
            actions.setPackageFilters({
              tags: validTags,
            })
          }
        }}
        onInputChange={(_, search, reason) => {
          if (reason !== "reset") {
            actions.setPackageFilters({ search })
          }
        }}
        options={options}
        size="small"
        sx={{ flex: 1 }}
        renderInput={props => <TextField {...props} autoFocus label="Search" />}
        renderOption={(props, option) => (
          <li key={option} {...props}>
            {getTagLabel(option, true)}
          </li>
        )}
        value={packageFilters.tags}
      />
    </Box>
  )
}
