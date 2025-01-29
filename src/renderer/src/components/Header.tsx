import { type ComponentType, type ReactNode, useEffect, useState } from "react"

import { FlexCol, FlexRow } from "@components/FlexBox"
import { type IconProps, Link } from "@mui/material"
import { type Location, useHistory } from "@utils/navigation"
import { Text } from "./Text"
import { Thumbnail } from "./Thumbnail"
import { ImageViewer } from "./Viewer/ImageViewer"

export type HeaderProps<T> = T & {
  isListItem?: boolean
  setActive?: (active: boolean) => void
}

export function Header({
  actions,
  compact,
  description,
  icon: IconComponent,
  iconColor,
  iconDescription,
  images,
  isListItem,
  location,
  onClick,
  setActive,
  subtitle,
  summary,
  tags,
  thumbnail = images?.at(0),
  thumbnailShape,
  thumbnailSize,
  title,
  tools,
}: HeaderProps<{
  actions?: ReactNode
  compact?: boolean
  description?: string
  images?: string[]
  icon?: ComponentType<{ color?: IconProps["color"]; fontSize: "inherit" }>
  iconColor?: IconProps["color"]
  iconDescription?: string
  isLoading?: boolean
  loadingLabel?: string
  location?: Location
  onClick?: () => void
  subtitle?: string
  summary?: string
  tags?: ReactNode
  thumbnail?: string
  /** Defaults to "square" */
  thumbnailShape?: "round" | "square"
  /** Defaults to "large" */
  thumbnailSize?: "large" | "small"
  title: string
  tools?: ReactNode
}>): JSX.Element {
  const history = useHistory()

  const [focus, setFocus] = useState(false)
  const [hover, setHover] = useState(false)

  const [openImages, setOpenImages] = useState(false)

  const active = !!isListItem && (focus || hover)

  const onClickTitle = () => {
    if (onClick) {
      onClick()
      setFocus(false)
    } else if (isListItem && location) {
      history.push(location)
    }
  }

  useEffect(() => {
    setActive?.(active)
  }, [setActive, active])

  const titleElement = (
    <Text maxLines={1} fontSize="inherit" fontWeight={500} marginTop="2px" title={title}>
      {title}
    </Text>
  )

  const subtitleElement = subtitle && (
    <Text maxLines={1} title={subtitle} variant="body2">
      {subtitle}
    </Text>
  )

  return (
    <FlexRow centered px={isListItem ? 0 : 2}>
      <FlexCol flex="1 1 0" overflow="hidden" pr={1}>
        <FlexRow>
          {!!images?.length && (
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

          <FlexCol flex="1 1 0" overflow="hidden">
            <FlexRow centered fontSize={compact ? 14 : 20} gap={1}>
              {IconComponent && (
                <FlexRow centered fontSize={compact ? 16 : 20} title={iconDescription}>
                  <IconComponent color={iconColor} fontSize="inherit" />
                </FlexRow>
              )}

              {onClick || (isListItem && location) ? (
                <Link
                  color="inherit"
                  onBlur={() => setFocus(false)}
                  onClick={onClickTitle}
                  onFocus={event => setFocus(event.target === event.currentTarget)}
                  onKeyDown={event => event.key === "Enter" && onClickTitle}
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

              {compact && tags}
            </FlexRow>

            <FlexRow centered>
              {isListItem && location && subtitleElement ? (
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

              {tools}
            </FlexRow>

            {!compact && tags}
          </FlexCol>
        </FlexRow>

        {isListItem && (summary ?? description) && (
          <Text
            fontStyle={summary ? "italic" : undefined}
            maxLines={summary ? undefined : 2}
            mt={2}
            title={description}
            variant="body2"
          >
            {summary ?? description}
          </Text>
        )}
      </FlexCol>

      {actions}
    </FlexRow>
  )
}
