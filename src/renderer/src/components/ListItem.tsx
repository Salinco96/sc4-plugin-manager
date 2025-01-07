import { Card, CardContent } from "@mui/material"
import { type ComponentType, useState } from "react"

export function ListItem<T>({
  header: Header,
  isDisabled,
  ...props
}: T & {
  header: ComponentType<
    Omit<T, "header" | "isDisabled"> & {
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
        height: "100%",
        opacity: isDisabled ? 0.6 : undefined,
      }}
    >
      <CardContent sx={{ width: "100%" }}>
        <Header isDisabled={isDisabled} isListItem setActive={setActive} {...props} />
      </CardContent>
    </Card>
  )
}
