import { Box, CircularProgress, styled } from "@mui/material"

const Container = styled(Box)`
  align-items: center;
  display: flex;
  height: 100%;
  justify-content: center;
  width: 100%;
`

export function Loader(): JSX.Element {
  return (
    <Container>
      <CircularProgress size={60} />
    </Container>
  )
}
