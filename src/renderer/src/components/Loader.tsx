import { Box, CircularProgress, type CircularProgressProps, styled } from "@mui/material"

const Container = styled(Box)`
  align-items: center;
  display: flex;
  height: 100%;
  justify-content: center;
  width: 100%;
`

export type LoaderProps = Pick<CircularProgressProps, "color" | "size">

export function Loader({ color, size }: LoaderProps): JSX.Element {
  return (
    <Container>
      <CircularProgress color={color} size={size ?? 60} />
    </Container>
  )
}
