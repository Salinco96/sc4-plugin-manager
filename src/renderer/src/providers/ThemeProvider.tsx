import { ReactNode } from "react"

import { createTheme, ThemeProvider as MuiThemeProvider } from "@mui/material/styles"

import "@fontsource/roboto/300.css"
import "@fontsource/roboto/400.css"
import "@fontsource/roboto/500.css"
import "@fontsource/roboto/700.css"

const theme = createTheme({})

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  return <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
}
