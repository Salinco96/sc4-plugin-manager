import { useState } from "react"

import { Chip, ChipProps, Tooltip } from "@mui/material"
import { useTranslation } from "react-i18next"

import { PackageID } from "@common/packages"
import { PackageState, getState } from "@common/types"
import { removeElement, removeElement$ } from "@common/utils/arrays"
import { keys } from "@common/utils/objects"
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

const stateTagColors: {
  [state in PackageState]?: "error" | "info" | "success" | "warning"
} = {
  [PackageState.ENABLED]: "success",
  [PackageState.DEPENDENCY]: "success",
  [PackageState.DEPRECATED]: "warning",
  [PackageState.DISABLED]: "error",
  [PackageState.ERROR]: "error",
  [PackageState.EXPERIMENTAL]: "warning",
  [PackageState.LOCAL]: "warning",
  [PackageState.NEW]: "info",
  [PackageState.OUTDATED]: "warning",
  [PackageState.PATCHED]: "warning",
}

export function PackageTag({ dense, ...tag }: Tag & { dense?: boolean }): JSX.Element {
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

  const sharedProps: ChipProps = {
    color: tag.type === TagType.STATE ? stateTagColors[tag.value] : undefined,
    label: getTagLabel(tag, authors),
    size: dense ? "small" : "medium",
    sx: {
      borderRadius: dense ? 1 : 2,
      fontSize: dense ? 10 : undefined,
      fontWeight: 400,
      height: dense ? 16 : undefined,
      letterSpacing: dense ? "normal" : undefined,
      lineHeight: dense ? "normal" : undefined,
      textTransform: "none",
    },
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
    ...keys(stateTagColors)
      .filter(state => getState(state, packageInfo, variantInfo, currentProfile))
      .map(state => createTag(TagType.STATE, state)),
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
        <PackageTag key={serializeTag(tag.type, tag.value)} {...tag} />
      ))}
    </FlexBox>
  )
}
