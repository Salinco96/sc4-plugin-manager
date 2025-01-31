import { Link } from "@mui/material"
import type { ReactNode } from "react"

export function TextLink({
  description,
  ...props
}: {
  children: ReactNode
  description: string
  onClick: () => void
}): JSX.Element {
  return (
    <Link
      color="inherit"
      sx={{ cursor: "pointer", fontWeight: "bold" }}
      title={description}
      underline="hover"
      {...props}
    />
  )
}
