import { Box, type BoxProps } from "@mui/material"

export interface FlexBoxProps extends Omit<BoxProps, "display" | "flexDirection"> {
  centered?: boolean
  direction?: "column" | "row"
  fullHeight?: boolean
  fullWidth?: boolean
}

export function FlexBox({
  centered,
  direction,
  fullHeight,
  fullWidth,
  ...props
}: FlexBoxProps): JSX.Element {
  return (
    <Box
      alignItems={centered ? "center" : undefined}
      display="flex"
      flexDirection={direction}
      height={fullHeight ? "100%" : undefined}
      justifyContent={centered && !direction ? "center" : undefined}
      width={fullWidth ? "100%" : undefined}
      {...props}
    />
  )
}

export function FlexRow(props: Omit<FlexBoxProps, "direction">): JSX.Element {
  return <FlexBox {...props} direction="row" />
}

export function FlexCol({ centered, ...props }: Omit<FlexBoxProps, "direction">): JSX.Element {
  return <FlexBox {...props} direction="column" />
}
