// Needs to be imported first for some reason - see https://github.com/mui/material-ui/issues/31835
import CssBaseline from "@mui/material/CssBaseline"

import { Content } from "./Content"
import { Layout } from "./Layout"
import { DataProvider } from "./providers/DataProvider"
import { SnackbarProvider } from "./providers/SnackbarProvider"
import { ThemeProvider } from "./providers/ThemeProvider"

/**
 * Main application component, declaring all global providers.
 */
function App(): JSX.Element {
  return (
    <ThemeProvider>
      <SnackbarProvider>
        <CssBaseline />
        <DataProvider>
          <Layout>
            <Content />
          </Layout>
        </DataProvider>
      </SnackbarProvider>
    </ThemeProvider>
  )
}

export default App
