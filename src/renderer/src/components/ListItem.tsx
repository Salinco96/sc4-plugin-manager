import { Card, CardContent, Divider } from "@mui/material"
import { type ComponentType, type ReactNode, useState } from "react"

export function ListItem<T>({
  children,
  header: Header,
  isDisabled,
  ...props
}: T & {
  children?: ReactNode
  header: ComponentType<
    Omit<T, "children" | "header" | "isDisabled"> & {
      isDisabled?: boolean
      isListItem?: boolean
      setActive?: (active: boolean) => void
    }
  >
  isDisabled?: boolean
}): JSX.Element {
  const [active, setActive] = useState(false)

  return (
    <Card
      elevation={active ? 8 : 1}
      sx={{
        color: isDisabled ? "rgba(0, 0, 0, 0.38)" : undefined,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        opacity: isDisabled ? 0.6 : undefined,
        width: "100%",
      }}
    >
      <CardContent sx={{ width: "100%" }}>
        <Header isDisabled={isDisabled} isListItem setActive={setActive} {...props} />
        {children && <Divider sx={{ my: 2 }} />}
        {children}
      </CardContent>
    </Card>
  )
}
