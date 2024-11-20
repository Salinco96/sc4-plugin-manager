import type { ReactNode } from "react"

import { SnackbarProvider as Provider } from "notistack"

import { SnackbarComponents } from "@components/Snackbar"

export function SnackbarProvider({ children }: { children: ReactNode }): JSX.Element {
  return <Provider Components={SnackbarComponents}>{children}</Provider>
}
