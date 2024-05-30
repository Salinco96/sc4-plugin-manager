import { ReactNode } from "react"

import { createTheme, ThemeProvider as MuiThemeProvider } from "@mui/material"

import "@fontsource/roboto/300.css"
import "@fontsource/roboto/400.css"
import "@fontsource/roboto/500.css"
import "@fontsource/roboto/700.css"

declare module "@mui/material/styles" {
  interface Palette {
    experimental: Palette["primary"]
    incompatible: Palette["primary"]
  }

  interface PaletteOptions {
    experimental?: PaletteOptions["primary"]
    incompatible?: PaletteOptions["primary"]
  }
}

declare module "@mui/material/Alert" {
  interface AlertPropsColorOverrides {
    experimental: true
    incompatible: true
  }
}

const theme = createTheme({
  palette: {
    experimental: {
      light: "#9400d3",
      main: "#9400d3",
    },
    incompatible: {
      light: "#696969",
      main: "#696969",
    },
  },
})

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  return <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
}
