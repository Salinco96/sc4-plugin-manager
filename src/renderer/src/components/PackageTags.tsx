import { useState } from "react"

import { Chip, Tooltip } from "@mui/material"
import { useTranslation } from "react-i18next"

import { PackageID } from "@common/packages"
import { PackageState, getState } from "@common/types"
import { removeElement, removeElement$ } from "@common/utils/arrays"
import { Page, useLocation } from "@utils/navigation"
import { useCurrentVariant, usePackageInfo } from "@utils/packages"
import {
  PackageFilters,
  useAuthors,
  useCurrentProfile,
  useStore,
  useStoreActions,
} from "@utils/store"

import { FlexBox } from "./FlexBox"
import {
  Tag,
  TagType,
  TagValue,
  createTag,
  getAuthorName,
  getTagLabel,
  serializeTag,
} from "./PackageList/utils"

export type TagInfo<T extends TagType = TagType> = Tag<T> & {
  color?: "error" | "info" | "success" | "warning"
}

const tags: TagInfo<TagType.STATE>[] = [
  {
    color: "success",
    type: TagType.STATE,
    value: PackageState.ENABLED,
  },
  {
    color: "success",
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
  const authors = useAuthors()
  const categories = useStore(store => store.categories)
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

  const sharedProps = {
    color: tag.color,
    label: getTagLabel(tag, authors),
    size: "medium" as const,
    sx: { borderRadius: 2 },
  }

  return isSelectable ? (
    <Tooltip title={t(isSelected ? "actions.unselect" : "actions.select")}>
      <Chip
        {...sharedProps}
        onClick={() => {
          if (values.includes(tag.value)) {
            actions.setPackageFilters({ [key]: removeElement(values, tag.value) })
          } else {
            const newValues = [...values, tag.value]
            if (tag.type === TagType.CATEGORY) {
              let category = categories[tag.value]?.parent
              while (category) {
                removeElement$(newValues, category)
                category = categories[category]?.parent
              }
            }

            actions.setPackageFilters({ [key]: newValues })
          }
        }}
        variant={isSelected ? "filled" : "outlined"}
      />
    </Tooltip>
  ) : (
    <Chip {...sharedProps} variant="filled" />
  )
}

export function PackageTags({ packageId }: { packageId: PackageID }): JSX.Element | null {
  const authors = useAuthors()
  const currentProfile = useCurrentProfile()
  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useCurrentVariant(packageId)

  const { t } = useTranslation("PackageTag")

  const authorTags = variantInfo.authors.map(authorId => createTag(TagType.AUTHOR, authorId))

  const [authorsExpanded, setAuthorsExpanded] = useState(authorTags.length <= 2)

  const packageTags = [
    ...(authorsExpanded ? authorTags : []),
    ...variantInfo.categories.map(category => createTag(TagType.CATEGORY, category)),
    ...tags.filter(tag => getState(tag.value, packageInfo, variantInfo, currentProfile)),
  ]

  if (packageTags.length === 0) {
    return null
  }

  return (
    <FlexBox direction="row" gap={1} mt={1}>
      {!!authorTags.length && !authorsExpanded && (
        <Tooltip title={t("actions.expandAuthors")}>
          <Chip
            label={t("andOthers", {
              count: authorTags.length - 1,
              label: getAuthorName(authorTags[0].value, authors),
              ns: "General",
            })}
            onClick={() => setAuthorsExpanded(true)}
            size="medium"
            sx={{ borderRadius: 2 }}
            variant="outlined"
          />
        </Tooltip>
      )}
      {packageTags.map(tag => (
        <PackageTag key={serializeTag(tag.type, tag.value)} tag={tag} />
      ))}
    </FlexBox>
  )
}
