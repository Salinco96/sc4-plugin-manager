import { ComponentType } from "react"

import { IconButton } from "@mui/material"

export function PackageToolButton({
  description,
  icon: IconComponent,
  onClick,
}: {
  description: string
  icon: ComponentType<{ fontSize: "inherit" }>
  onClick: () => void
}): JSX.Element {
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
