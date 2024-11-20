import { Chip, type ChipProps, Tooltip } from "@mui/material"
import { useTranslation } from "react-i18next"

import { removeElement, removeElement$ } from "@common/utils/arrays"
import { Page, useLocation } from "@utils/navigation"
import { useAuthors, usePackageFilters, useStore, useStoreActions } from "@utils/store"

import { STATE_TAGS, type Tag, TagType, type TagValue, getTagLabel } from "./utils"

export type PackageTagProps = Tag & { dense?: boolean }

export function PackageTag({ dense, ...tag }: PackageTagProps): JSX.Element {
  const actions = useStoreActions()
  const authors = useAuthors()
  const categories = useStore(store => store.categories)
  const filters = usePackageFilters()
  const location = useLocation()

  const { t } = useTranslation("PackageTag")

  const key = {
    author: "authors" as const,
    category: "categories" as const,
    state: "states" as const,
  }[tag.type]

  const values: TagValue<TagType>[] = filters[key]

  const isSelectable = location.page === Page.Packages
  const isSelected = values.includes(tag.value)

  const sharedProps: ChipProps = {
    color: tag.type === TagType.STATE ? (STATE_TAGS[tag.value] ?? undefined) : undefined,
    label: getTagLabel(t, tag, authors, categories),
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
