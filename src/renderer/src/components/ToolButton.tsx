import { IconButton } from "@mui/material"
import type { ComponentType } from "react"

import { FlexBox, type FlexBoxProps } from "./FlexBox"

export interface ToolButtonProps {
  description: string
  disabled?: boolean
  icon: ComponentType<{ fontSize: "inherit" }>
  onClick?: () => void
  size?: FlexBoxProps["fontSize"]
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
      <FlexBox color="inherit" fontSize={size ?? "1.125rem"} title={description}>
        <IconComponent fontSize="inherit" />
      </FlexBox>
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
