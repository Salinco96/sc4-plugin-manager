import { Chip, type ChipProps, Tooltip } from "@mui/material"
import { useTranslation } from "react-i18next"

import { store } from "@stores/main"

import { STATE_TAGS, type TagInfo, TagType, getTagLabel } from "./utils"

export type TagColor = "error" | "info" | "success" | "warning"

export type TagProps = {
  color?: TagColor
  dense?: boolean
  isSelected?: boolean
  onClick?: () => void
  tag: TagInfo
}

export function Tag({ color, dense, isSelected, onClick, tag }: TagProps): JSX.Element {
  const authors = store.useAuthors()
  const categories = store.useCategories()

  const { t } = useTranslation("PackageTag")

  const sharedProps: ChipProps = {
    color: color ?? getTagColor(tag),
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

  return onClick ? (
    <Tooltip title={t(isSelected ? "actions.unselect" : "actions.select")}>
      <Chip {...sharedProps} onClick={onClick} variant={isSelected ? "filled" : "outlined"} />
    </Tooltip>
  ) : (
    <Chip {...sharedProps} variant="filled" />
  )
}

function getTagColor(tag: TagInfo): TagColor | undefined {
  return tag.type === TagType.STATE ? STATE_TAGS[tag.value] : undefined
}
