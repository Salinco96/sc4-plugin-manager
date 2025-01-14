import { Box, type BoxProps, IconButton } from "@mui/material"
import type { ComponentType } from "react"

export interface ToolButtonProps {
  description: string
  disabled?: boolean
  icon: ComponentType<{ fontSize: "inherit" }>
  onClick?: () => void
  size?: BoxProps["fontSize"]
}

export function ToolButton({
  description,
  disabled,
  icon: IconComponent,
  onClick,
  size,
}: ToolButtonProps): JSX.Element {
  if (!onClick) {
    return (
      <Box color="inherit" fontSize={size ?? "1.125rem"} title={description}>
        <IconComponent fontSize="inherit" />
      </Box>
    )
  }

  return (
    <IconButton
      aria-label={description}
      color="inherit"
      disabled={disabled}
      onClick={onClick}
      size="small"
      sx={{ fontSize: size, padding: 0 }}
      title={description}
    >
      <IconComponent fontSize="inherit" />
    </IconButton>
  )
}
