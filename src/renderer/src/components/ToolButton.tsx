import type { ComponentType } from "react"

import { IconButton } from "@mui/material"

import { FlexBox } from "./FlexBox"

export interface ToolButtonProps {
  description: string
  icon: ComponentType<{ fontSize: "inherit" }>
  onClick?: () => void
}

export function ToolButton({
  description,
  icon: IconComponent,
  onClick,
}: ToolButtonProps): JSX.Element {
  if (!onClick) {
    return (
      <FlexBox color="inherit" fontSize="1.125rem" title={description}>
        <IconComponent fontSize="inherit" />
      </FlexBox>
    )
  }

  return (
    <IconButton
      aria-label={description}
      color="inherit"
      onClick={onClick}
      size="small"
      sx={{ padding: 0 }}
      title={description}
    >
      <IconComponent fontSize="inherit" />
    </IconButton>
  )
}
