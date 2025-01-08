import { Box, Chip, Tooltip } from "@mui/material"
import { difference } from "@salinco/nice-utils"
import { useAuthors } from "@utils/store"
import { type ComponentType, useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Tag } from "./Tag"
import { type Tag as TagInfo, TagType, getAuthorName, serializeTag } from "./utils"

export function Tags({
  component: TagComponent = Tag,
  tags,
}: {
  component?: ComponentType<{ tag: TagInfo }>
  tags: TagInfo[]
}): JSX.Element | null {
  const authors = useAuthors()

  const containerRef = useRef<HTMLDivElement | null>(null)

  const { t } = useTranslation("PackageTag")

  const authorTags = tags.filter(tag => tag.type === TagType.AUTHOR)

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

  const filteredTags = authorsExpanded ? tags : difference(tags, authorTags)

  const isScrollable = isScrollableLeft || isScrollableRight

  if (filteredTags.length === 0) {
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
          overflowY: "hidden",
          scrollbarWidth: isScrollable ? "thin" : undefined,
        },
        "&:hover .MuiChip-root": {
          height: isScrollable ? 24 : undefined,
        },
      }}
    >
      <Box
        display="flex"
        gap={1}
        overflow="scroll"
        onScroll={onScroll}
        ref={containerRef}
        sx={{ scrollbarWidth: "none" }}
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
        {filteredTags.map(tag => (
          <TagComponent key={serializeTag(tag.type, tag.value)} tag={tag} />
        ))}
      </Box>
    </Box>
  )
}
