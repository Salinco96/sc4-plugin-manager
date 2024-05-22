import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import { styled } from "@mui/material/styles"

const Container = styled(Box)`
  align-items: center;
  display: flex;
  height: 100%;
  justify-content: center;
`

/**
 * Loading page.
 */
export function Loading(): JSX.Element {
  return (
    <Container>
      <CircularProgress size={60} />
    </Container>
  )
}
