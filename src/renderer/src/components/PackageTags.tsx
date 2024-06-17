import { useCallback } from "react"

import { Chip, List, Tooltip } from "@mui/material"

import { PackageCategory, PackageState, getCategory, getState } from "@common/types"
import { Page, useLocation } from "@utils/navigation"
import { useCurrentVariant, usePackageInfo } from "@utils/packages"
import { useCurrentProfile, useStore, useStoreActions } from "@utils/store"

import { TagType } from "./PackageList/utils"

interface TagInfo {
  color?: "success" | "error" | "warning"
  id: string
  label: string
  category?: PackageCategory
  state?: PackageState
}

const tags: TagInfo[] = [
  {
    id: `${TagType.CATEGORY}:${PackageCategory.DEPENDENCIES}`,
    label: "Dependency",
    category: PackageCategory.DEPENDENCIES,
  },
  {
    id: `${TagType.CATEGORY}:${PackageCategory.MODS}`,
    label: "Mod",
    category: PackageCategory.MODS,
  },
  {
    id: `${TagType.CATEGORY}:${PackageCategory.RESIDENTIAL}`,
    label: "Residential",
    category: PackageCategory.RESIDENTIAL,
  },
  {
    id: `${TagType.CATEGORY}:${PackageCategory.COMMERCIAL}`,
    label: "Commercial",
    category: PackageCategory.COMMERCIAL,
  },
  {
    id: `${TagType.CATEGORY}:${PackageCategory.INDUSTRIAL}`,
    label: "Industrial",
    category: PackageCategory.INDUSTRIAL,
  },
  {
    id: `${TagType.CATEGORY}:${PackageCategory.CIVICS}`,
    label: "Civics",
    category: PackageCategory.CIVICS,
  },
  {
    id: `${TagType.CATEGORY}:${PackageCategory.LANDMARKS}`,
    label: "Landmark",
    category: PackageCategory.LANDMARKS,
  },
  {
    id: `${TagType.CATEGORY}:${PackageCategory.PARKS}`,
    label: "Park",
    category: PackageCategory.PARKS,
  },
  {
    id: `${TagType.CATEGORY}:${PackageCategory.ENERGY}`,
    label: "Energy",
    category: PackageCategory.ENERGY,
  },
  {
    id: `${TagType.CATEGORY}:${PackageCategory.TRANSPORT}`,
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
  {
    id: "experimental",
    label: "Experimental",
    state: PackageState.EXPERIMENTAL,
    color: "warning",
  },
]

export function PackageTag({ tag }: { tag: TagInfo }): JSX.Element {
  const actions = useStoreActions()
  const filters = useStore(store => store.packageFilters)
  const location = useLocation()

  const filtering = location.page === Page.Packages

  const selected = tag.category && filters.tags.includes(tag.id)

  const onClick = useCallback(() => {
    if (tag.category) {
      if (selected) {
        actions.setPackageFilters({ tags: filters.tags.filter(id => id !== tag.id) })
      } else {
        actions.setPackageFilters({ tags: filters.tags.concat(tag.id) })
      }
    }
  }, [actions, filters, selected])

  if (filtering) {
    return (
      <Tooltip title={selected ? "Remove filter" : "Add filter"}>
        <Chip
          color={tag.color}
          component="li"
          label={tag.label}
          onClick={onClick}
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

export function PackageTags({ packageId }: { packageId: string }): JSX.Element | null {
  const currentProfile = useCurrentProfile()
  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useCurrentVariant(packageId)
  const category = getCategory(variantInfo)

  const packageTags = tags.filter(tag => {
    if (tag.category) {
      return tag.category === category
    }

    if (tag.state) {
      return getState(tag.state, packageInfo, variantInfo.id, currentProfile)
    }

    return false
  })

  if (packageTags.length === 0) {
    return null
  }

  return (
    <List
      disablePadding
      sx={{ display: "flex", flexDirection: "row", gap: 1, /* marginBottom: 1, */ marginTop: 1 }}
    >
      {packageTags.map(tag => (
        <PackageTag key={tag.id} tag={tag} />
      ))}
    </List>
  )
}
