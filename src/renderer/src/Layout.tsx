import { ReactNode } from "react"

import Box from "@mui/material/Box"
import Drawer from "@mui/material/Drawer"
import { styled } from "@mui/material/styles"
import Toolbar from "@mui/material/Toolbar"

import { AppBar } from "./components/AppBar"
import { DrawerTabs } from "./components/DrawerTabs"

const drawerWidth = 240

const Container = styled(Box)`
  display: flex;
  flex-direction: column;
  padding-left: ${drawerWidth}px;
  height: 100vh;
  width: 100vw;
`

const Main = styled(Box)`
  height: 100%;
  overflow: hidden;
`

/**
 * Fixed layout for all pages (top bar, left menu tabs...).
 */
export function Layout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Container>
      <AppBar />
      <Drawer PaperProps={{ sx: { width: drawerWidth } }} variant="permanent">
        <Toolbar />
        <DrawerTabs />
      </Drawer>

      {/* Fake empty toolbar to offset main content by the toolbar height */}
      <Toolbar />

      <Main component="main">{children}</Main>
    </Container>
  )
}
