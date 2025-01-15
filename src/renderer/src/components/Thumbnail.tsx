import { Box, type BoxProps, Button } from "@mui/material"

export interface ThumbnailProps extends Omit<BoxProps, "height" | "width"> {
  disabled?: boolean
  onClick?: () => void
  round?: boolean
  size: number
  src: string
}

export function Thumbnail({
  disabled,
  onClick,
  round,
  size,
  src,
  ...props
}: ThumbnailProps): JSX.Element {
  return (
    <Box flex={0} {...props}>
      <Button
        disabled={disabled || !onClick}
        onClick={onClick}
        sx={{
          borderRadius: 0,
          minWidth: 0,
          padding: 0,
          "& .hover": {
            opacity: 0,
          },
          "&:hover .hover": {
            opacity: disabled || !onClick ? undefined : 0.2,
          },
        }}
        title="Click to open" // todo
      >
        <Box
          sx={{
            backgroundColor: "#eee",
            backgroundImage: `url("${src}")`,
            backgroundPosition: "50%",
            backgroundSize: "cover",
            borderRadius: round ? "100%" : undefined,
            height: size,
            overflow: "hidden",
            width: size,
          }}
        >
          <Box
            className="hover"
            sx={{
              backgroundColor: "#000",
              height: size,
              width: size,
              transition(theme) {
                return theme.transitions.create("opacity", {
                  duration: theme.transitions.duration.standard,
                })
              },
            }}
          />
        </Box>
      </Button>
    </Box>
  )
}
