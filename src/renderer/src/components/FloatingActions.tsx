import { Fab } from "@mui/material"
import type { ComponentType } from "react"

export type FloatingAction = {
  /** Defaults to "primary" */
  color?: "error" | "info" | "primary" | "success" | "warning"
  description: string
  icon: ComponentType
  id: string
  onClick: () => void
}

export type FloatingActionsProps = {
  actions: Array<FloatingAction | false | null | undefined>
}

export function FloatingActions({ actions }: FloatingActionsProps): JSX.Element | null {
  const filteredActions = actions?.filter(action => !!action)

  if (!filteredActions?.length) {
    return null
  }

  return (
    <>
      {filteredActions.map(({ color, description, icon: Component, id, onClick }, index) => (
        <Fab
          color={color ?? "primary"}
          key={id}
          onClick={onClick}
          sx={{ position: "absolute", bottom: 16, right: 16 + index * 64 }}
          title={description}
        >
          <Component />
        </Fab>
      ))}
    </>
  )
}
