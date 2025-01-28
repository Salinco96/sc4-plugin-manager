import { Card, CardContent, Divider } from "@mui/material"
import { type ComponentType, type ReactNode, useState } from "react"
import type { HeaderProps } from "./Header"

export function ListItem<T>(
  props: T & {
    banners?: ComponentType<T>
    children?: ReactNode
    compact?: boolean
    header: ComponentType<HeaderProps<T>>
    isDisabled?: boolean
  },
): JSX.Element {
  const { banners: Banners, children, compact, header: Header, isDisabled } = props

  const [active, setActive] = useState(false)

  return (
    <Card
      elevation={active ? 4 : 1}
      sx={{
        color: isDisabled ? "rgba(0, 0, 0, 0.38)" : undefined,
        display: "flex",
        flexDirection: "column",
        opacity: isDisabled ? 0.6 : undefined,
        width: "100%",
      }}
    >
      <CardContent
        sx={{
          py: compact ? 1 : 2,
          width: "100%",
          "&:last-child": {
            pb: compact ? 1 : 3,
          },
        }}
      >
        <Header isListItem setActive={setActive} {...props} />
        {Banners && <Banners {...props} />}
        {children && !compact && <Divider sx={{ my: 2 }} />}
        {children}
      </CardContent>
    </Card>
  )
}
