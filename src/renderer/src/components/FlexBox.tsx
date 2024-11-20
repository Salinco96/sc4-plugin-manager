import { Box, type BoxProps } from "@mui/material"

export interface FlexBoxProps extends Omit<BoxProps, "display" | "flexDirection"> {
  direction?: "column" | "row"
}

export function FlexBox({ direction, ...props }: FlexBoxProps): JSX.Element {
  return <Box display="flex" flexDirection={direction} {...props} />
}
