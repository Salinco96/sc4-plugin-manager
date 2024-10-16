import { ComponentType } from "react"

import { IconButton } from "@mui/material"

export interface ToolButtonProps {
  description: string
  icon: ComponentType<{ fontSize: "inherit" }>
  onClick: () => void
}

export function ToolButton({
  description,
  icon: IconComponent,
  onClick,
}: ToolButtonProps): JSX.Element {
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
