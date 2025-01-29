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
      justifyContent={centered ? "center" : undefined}
      width={fullWidth ? "100%" : undefined}
      {...props}
    />
  )
}

export function FlexRow({ centered, ...props }: Omit<FlexBoxProps, "direction">): JSX.Element {
  return <FlexBox direction="row" alignItems={centered ? "center" : undefined} {...props} />
}

export function FlexCol({ centered, ...props }: Omit<FlexBoxProps, "direction">): JSX.Element {
  return <FlexBox direction="column" alignItems={centered ? "center" : undefined} {...props} />
}
