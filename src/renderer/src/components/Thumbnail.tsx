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
  if (disabled || !onClick) {
    return (
      <Box
        sx={{
          backgroundImage: `url("${src}")`,
          backgroundPosition: "50%",
          backgroundSize: "cover",
          borderRadius: round ? "100%" : undefined,
          flex: "0 0 auto",
          height: size,
          width: size,
        }}
        {...props}
      />
    )
  }

  return (
    <Box flex="0 0 auto" {...props}>
      <Button
        onClick={onClick}
        sx={{
          borderRadius: 0,
          padding: 0,
          "& .hover": {
            opacity: 0,
          },
          "&:hover .hover": {
            opacity: 0.15,
          },
        }}
      >
        <Box
          sx={{
            backgroundImage: `url("${src}")`,
            backgroundPosition: "50%",
            backgroundSize: "cover",
            height: size,
            width: size,
          }}
        >
          <Box
            className="hover"
            sx={{
              backgroundColor: "black",
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
