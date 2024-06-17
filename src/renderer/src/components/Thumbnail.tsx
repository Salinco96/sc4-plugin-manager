import { Box, BoxProps } from "@mui/material"

export interface ThumbnailProps extends Omit<BoxProps, "height" | "width"> {
  size: number
  src: string
}

export function Thumbnail({ size, src, ...props }: ThumbnailProps): JSX.Element {
  return (
    <Box
      flex="0 0 auto"
      height={size}
      sx={{
        backgroundImage: `url("${src}")`,
        backgroundPosition: "50%",
        backgroundSize: "cover",
      }}
      width={size}
      {...props}
    />
  )
}
