import { MouseEvent, useCallback } from "react"

import { Tooltip } from "@mui/material"
import Chip from "@mui/material/Chip"
import List from "@mui/material/List"

import { PackageCategory, PackageInfo, PackageState, getCategory, getState } from "@common/types"
import { Page } from "@renderer/pages"
import { useLocation } from "@renderer/stores/navigation"
import { useCurrentProfile, useStore, useStoreActions } from "@renderer/utils/store"

interface TagInfo {
  color?: "success" | "error" | "warning"
  id: string
  label: string
  category?: PackageCategory
  state?: PackageState
}

const tags: TagInfo[] = [
  {
    id: "dependencies",
    label: "Dependency",
    category: PackageCategory.DEPENDENCIES,
  },
  {
    id: "mods",
    label: "Mod",
    category: PackageCategory.MODS,
  },
  {
    id: "residential",
    label: "Residential",
    category: PackageCategory.RESIDENTIAL,
  },
  {
    id: "commercial",
    label: "Commercial",
    category: PackageCategory.COMMERCIAL,
  },
  {
    id: "industrial",
    label: "Industrial",
    category: PackageCategory.INDUSTRIAL,
  },
  {
    id: "civics",
    label: "Civics",
    category: PackageCategory.CIVICS,
  },
  {
    id: "landmarks",
    label: "Landmark",
    category: PackageCategory.LANDMARKS,
  },
  {
    id: "parks",
    label: "Park",
    category: PackageCategory.PARKS,
  },
  {
    id: "energy",
    label: "Energy",
    category: PackageCategory.ENERGY,
  },
  {
    id: "transport",
    label: "Transport",
    category: PackageCategory.TRANSPORT,
  },
  {
    id: "enabled",
    label: "Enabled",
    state: PackageState.ENABLED,
    color: "success",
  },
  {
    id: "disabled",
    label: "Disabled",
    state: PackageState.DISABLED,
    color: "error",
  },
  {
    id: "error",
    label: "Error",
    state: PackageState.ERROR,
    color: "error",
  },
  {
    id: "outdated",
    label: "Outdated",
    state: PackageState.OUTDATED,
    color: "warning",
  },
  {
    id: "local",
    label: "Local",
    state: PackageState.LOCAL,
    color: "warning",
  },
]

export function PackageTag({
  onHover,
  tag,
}: {
  onHover?: (hover: boolean) => void
  tag: TagInfo
}): JSX.Element {
  const actions = useStoreActions()
  const filters = useStore(store => store.packageFilters)
  const location = useLocation()

  const filtering = location.page === Page.Packages

  const selected = tag.category !== undefined && filters.categories.includes(tag.category)

  const onClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation()

      if (tag.category) {
        actions.setPackageFilters({
          ...filters,
          categories: filters.categories.includes(tag.category)
            ? filters.categories.filter(category => category !== tag.category)
            : filters.categories.concat(tag.category),
        })
      }

      // if (tag.state) {
      //   actions.setPackageFilters({
      //     ...filters,
      //     states: filters.states.includes(tag.state)
      //       ? filters.states.filter(state => state !== tag.state)
      //       : filters.states.concat(tag.state),
      //   })
      // }
    },
    [actions, filters, selected],
  )

  if (filtering) {
    return (
      <Tooltip title={selected ? "Remove filter" : "Add filter"}>
        <Chip
          color={tag.color}
          component="li"
          label={tag.label}
          onClick={onClick}
          onMouseEnter={() => onHover?.(true)}
          onMouseLeave={() => onHover?.(false)}
          size="medium"
          sx={{ borderRadius: 2 }}
          variant={selected ? "filled" : "outlined"}
        />
      </Tooltip>
    )
  }

  return (
    <Chip
      color={tag.color}
      component="li"
      label={tag.label}
      size="medium"
      sx={{ borderRadius: 2 }}
      variant="filled"
    />
  )
}

export function PackageTags({
  onHover,
  packageInfo,
}: {
  onHover?: (hover: boolean) => void
  packageInfo: PackageInfo
}): JSX.Element | null {
  const currentProfile = useCurrentProfile()

  const category = getCategory(packageInfo)
  const packageTags = tags.filter(tag => {
    if (tag.category) {
      return tag.category === category
    }

    if (tag.state) {
      return getState(packageInfo, tag.state, currentProfile)
    }

    return false
  })

  if (packageTags.length === 0) {
    return null
  }

  return (
    <List disablePadding sx={{ display: "flex", flexDirection: "row", gap: 1, marginTop: 1 }}>
      {packageTags.map(tag => (
        <PackageTag key={tag.id} onHover={onHover} tag={tag} />
      ))}
    </List>
  )
}
