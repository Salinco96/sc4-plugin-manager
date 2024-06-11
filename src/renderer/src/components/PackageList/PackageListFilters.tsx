import { useMemo } from "react"

import {
  DoDisturb as IncompatibleIcon,
  Download as DownloadedIcon,
  FileDownloadDone as EnabledIcon,
  FileDownloadOff as LocalIcon,
  // Science as ExperimentalIcon,
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
import { getCurrentVariant } from "@renderer/utils/packages"
import { useCurrentProfile, useStore, useStoreActions } from "@renderer/utils/store"

import { TagType, createTags, getTagLabel } from "./utils"

export function PackageListFilters(): JSX.Element {
  const actions = useStoreActions()

  const currentProfile = useCurrentProfile()
  const packages = useStore(store => store.packages)
  const packageFilters = useStore(store => store.packageFilters)

  const categories: string[] = useMemo(() => {
    // TODO: More categories, filter by other tags, filter by authors
    return Object.values(PackageCategory).sort()
  }, [])

  const authors: string[] = useMemo(() => {
    const authors = new Set<string>()

    if (packages) {
      for (const packageInfo of Object.values(packages)) {
        const variantInfo = getCurrentVariant(packageInfo, currentProfile)
        for (const author of variantInfo.authors) {
          authors.add(author)
        }
      }
    }

    return Array.from(authors).sort()
  }, [currentProfile, packages])

  const options: string[] = useMemo(() => {
    if (!packageFilters.search.trim()) {
      return []
    }

    const pattern = RegExp("\\b" + packageFilters.search.trim().replaceAll(/\W/g, "\\$&"), "i")
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
        {/* <Tooltip
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
        </Tooltip> */}
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
        filterOptions={options => options}
        freeSolo
        getOptionLabel={getTagLabel}
        inputValue={packageFilters.search}
        limitTags={4}
        multiple
        onChange={(_, tags) => actions.setPackageFilters({ tags })}
        onInputChange={(_, search) => actions.setPackageFilters({ search })}
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
