import { Box, Chip, Tooltip } from "@mui/material"
import { keys } from "@salinco/nice-utils"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import type { PackageID } from "@common/packages"
import { VariantState, getState } from "@common/types"
import type { VariantID } from "@common/variants"
import { usePackageInfo, useVariantInfo } from "@utils/packages"
import { useAuthors, useCurrentProfile } from "@utils/store"

import { PackageTag } from "./PackageTag"
import { STATE_TAGS, TagType, createTag, getAuthorName, serializeTag } from "./utils"

export function PackageTags({
  packageId,
  variantId,
}: {
  packageId: PackageID
  variantId?: VariantID
}): JSX.Element | null {
  const authors = useAuthors()
  const currentProfile = useCurrentProfile()
  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useVariantInfo(packageId, variantId)

  const containerRef = useRef<HTMLDivElement | null>(null)

  const { t } = useTranslation("PackageTag")

  const authorTags = variantInfo.authors.map(authorId => createTag(TagType.AUTHOR, authorId))

  const [authorsExpanded, setAuthorsExpanded] = useState(authorTags.length <= 2)

  const [isScrollableLeft, setScrollableLeft] = useState(false)
  const [isScrollableRight, setScrollableRight] = useState(false)

  const onScroll = useCallback(() => {
    const container = containerRef.current

    if (container && container.scrollWidth > container.clientWidth) {
      setScrollableLeft(container.scrollLeft > 1)
      setScrollableRight(container.scrollWidth - container.clientWidth - container.scrollLeft > 1)
    } else {
      setScrollableLeft(false)
      setScrollableRight(false)
    }
  }, [])

  useEffect(() => {
    onScroll()
    window.addEventListener("resize", onScroll)
    return () => window.removeEventListener("resize", onScroll)
  }, [onScroll])

  const packageTags = [
    ...(authorsExpanded ? authorTags : []),
    ...(variantId
      ? []
      : variantInfo.categories.map(category => createTag(TagType.CATEGORY, category))),
    ...keys(STATE_TAGS)
      .filter(state => STATE_TAGS[state])
      .filter(
        state =>
          !(
            variantId
              ? [
                  VariantState.DEPENDENCY,
                  VariantState.DISABLED,
                  VariantState.ENABLED,
                  VariantState.ERROR,
                ]
              : [VariantState.DEFAULT, VariantState.SELECTED]
          ).includes(state),
      )
      .filter(state => getState(state, packageInfo, variantInfo, currentProfile))
      .map(state => createTag(TagType.STATE, state)),
  ]

  const isScrollable = isScrollableLeft || isScrollableRight

  if (packageTags.length === 0) {
    return null
  }

  return (
    <Box
      sx={{
        marginTop: 1,
        position: "relative",
        "&:before": {
          background: "linear-gradient(to right, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)",
          bottom: 0,
          content: isScrollableLeft ? '""' : undefined,
          left: 0,
          pointerEvents: "none",
          position: "absolute",
          top: 0,
          width: 40,
          zIndex: 1,
        },
        "&:after": {
          background: "linear-gradient(to left, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)",
          bottom: 0,
          content: isScrollableRight ? '""' : undefined,
          pointerEvents: "none",
          position: "absolute",
          right: 0,
          top: 0,
          width: 40,
          zIndex: 1,
        },
        "&:hover > div": {
          scrollbarWidth: "thin",
        },
        "&:hover .MuiChip-root": {
          height: isScrollable ? 24 : undefined,
        },
      }}
    >
      <Box
        onScroll={onScroll}
        ref={containerRef}
        sx={{
          display: "flex",
          gap: 1,
          overflow: "auto",
          scrollbarWidth: "none",
        }}
      >
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
      </Box>
    </Box>
  )
}
