import { type ReactNode, useEffect, useState } from "react"

import { FlexBox } from "@components/FlexBox"
import { Link } from "@mui/material"
import { type Location, useHistory } from "@utils/navigation"
import { Text } from "./Text"
import { Thumbnail } from "./Thumbnail"
import { ToolBelt, type ToolBeltAction } from "./ToolBelt"
import { ImageViewer } from "./Viewer/ImageViewer"

export function Header({
  actions,
  description,
  images,
  isListItem,
  location,
  setActive,
  subtitle,
  summary,
  tags,
  thumbnail = images?.at(0),
  thumbnailShape,
  thumbnailSize,
  title,
  tools,
}: {
  actions?: ReactNode
  description?: string
  images?: string[]
  isListItem?: boolean
  isLoading?: boolean
  loadingLabel?: string
  location?: Location
  setActive?: (active: boolean) => void
  subtitle: string
  summary?: string
  tags?: ReactNode
  thumbnail?: string
  /** Defaults to "square" */
  thumbnailShape?: "round" | "square"
  /** Defaults to "large" */
  thumbnailSize?: "large" | "small"
  title: string
  tools?: ToolBeltAction[]
}): JSX.Element {
  const history = useHistory()

  const [focus, setFocus] = useState(false)
  const [hover, setHover] = useState(false)

  const [openImages, setOpenImages] = useState(false)

  const active = !!isListItem && (focus || hover)

  useEffect(() => {
    setActive?.(active)
  }, [setActive, active])

  const titleElement = (
    <Text maxLines={1} title={title} variant="h6">
      {title}
    </Text>
  )

  const subtitleElement = (
    <Text maxLines={1} title={subtitle} variant="body2">
      {subtitle}
    </Text>
  )

  return (
    <FlexBox alignItems="center" px={isListItem ? 0 : 2}>
      <FlexBox direction="column" flex="1 1 0" pr={1} sx={{ overflow: "hidden" }}>
        <FlexBox direction="row">
          {images?.length && (
            <ImageViewer images={images} onClose={() => setOpenImages(false)} open={openImages} />
          )}

          {thumbnail && (
            <Thumbnail
              disabled={!images?.length}
              mr={2}
              mt={1}
              onClick={() => setOpenImages(true)}
              round={thumbnailShape === "round"}
              size={thumbnailSize === "small" ? 56 : 84}
              src={thumbnail}
            />
          )}

          <FlexBox direction="column" flex="1 1 0" sx={{ overflow: "hidden" }}>
            {isListItem && location ? (
              <Link
                color="inherit"
                onBlur={() => setFocus(false)}
                onClick={() => history.push(location)}
                onFocus={event => setFocus(event.target === event.currentTarget)}
                onKeyDown={event => event.key === "Enter" && history.push(location)}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                sx={{
                  cursor: "pointer",
                  display: "block",
                  textDecoration: active ? "underline" : "unset",
                  width: "fit-content",
                }}
                tabIndex={0}
              >
                {titleElement}
              </Link>
            ) : (
              titleElement
            )}

            <FlexBox alignItems="center">
              {isListItem && location ? (
                <Link
                  color="inherit"
                  onClick={() => history.push(location)}
                  onMouseEnter={() => setHover(true)}
                  onMouseLeave={() => setHover(false)}
                  sx={{
                    cursor: "pointer",
                    textDecoration: active ? "underline" : "unset",
                  }}
                >
                  {subtitleElement}
                </Link>
              ) : (
                subtitleElement
              )}

              {tools && <ToolBelt actions={tools} />}
            </FlexBox>

            {tags}
          </FlexBox>
        </FlexBox>

        {isListItem && (summary ?? description) && (
          <Text
            maxLines={summary ? undefined : 2}
            sx={{ fontStyle: summary ? "italic" : undefined, marginTop: 2 }}
            title={description}
            variant="body2"
          >
            {summary ?? description}
          </Text>
        )}
      </FlexBox>

      {actions}
    </FlexBox>
  )
}
