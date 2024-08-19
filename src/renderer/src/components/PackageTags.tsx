import { Chip, Tooltip } from "@mui/material"
import { useTranslation } from "react-i18next"

import { getCategories } from "@common/categories"
import { PackageState, getState } from "@common/types"
import { toggleElement } from "@common/utils/arrays"
import { Page, useLocation } from "@utils/navigation"
import { useCurrentVariant, usePackageInfo } from "@utils/packages"
import { PackageFilters, useCurrentProfile, useStore, useStoreActions } from "@utils/store"

import { FlexBox } from "./FlexBox"
import { Tag, TagType, TagValue, getTagLabel, serializeTag } from "./PackageList/utils"

type TagInfo<T extends TagType = TagType> = Tag<T> & {
  color?: "error" | "info" | "success" | "warning"
}

const tags: TagInfo<TagType.STATE>[] = [
  {
    color: "success",
    type: TagType.STATE,
    value: PackageState.ENABLED,
  },
  {
    color: "info",
    type: TagType.STATE,
    value: PackageState.DEPENDENCY,
  },
  {
    color: "error",
    type: TagType.STATE,
    value: PackageState.DISABLED,
  },
  {
    color: "error",
    type: TagType.STATE,
    value: PackageState.ERROR,
  },
  {
    color: "info",
    type: TagType.STATE,
    value: PackageState.NEW,
  },
  {
    color: "warning",
    type: TagType.STATE,
    value: PackageState.OUTDATED,
  },
  {
    color: "warning",
    type: TagType.STATE,
    value: PackageState.LOCAL,
  },
  {
    color: "warning",
    type: TagType.STATE,
    value: PackageState.EXPERIMENTAL,
  },
]

export function PackageTag({ tag }: { tag: TagInfo }): JSX.Element {
  const actions = useStoreActions()
  const filters = useStore(store => store.packageFilters)
  const location = useLocation()

  const { t } = useTranslation("PackageTag")

  const key = {
    author: "authors",
    category: "categories",
    state: "states",
  }[tag.type] as keyof PackageFilters

  const values = filters[key] as TagValue<TagType>[]

  const isSelectable = location.page === Page.Packages
  const isSelected = values.includes(tag.value)

  return isSelectable ? (
    <Tooltip title={t(isSelected ? "actions.unselect" : "actions.select")}>
      <Chip
        color={tag.color}
        label={getTagLabel(tag)}
        onClick={() => actions.setPackageFilters({ [key]: toggleElement(values, tag.value) })}
        size="medium"
        sx={{ borderRadius: 2 }}
        variant={isSelected ? "filled" : "outlined"}
      />
    </Tooltip>
  ) : (
    <Chip
      color={tag.color}
      label={getTagLabel(tag)}
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

  const packageTags = [
    ...getCategories(variantInfo).map(category => ({ type: TagType.CATEGORY, value: category })),
    ...tags.filter(tag => getState(tag.value, packageInfo, variantInfo.id, currentProfile)),
  ] as TagInfo[]

  if (packageTags.length === 0) {
    return null
  }

  return (
    <FlexBox direction="row" gap={1} mt={1}>
      {packageTags.map(tag => (
        <PackageTag key={serializeTag(tag.type, tag.value)} tag={tag} />
      ))}
    </FlexBox>
  )
}
