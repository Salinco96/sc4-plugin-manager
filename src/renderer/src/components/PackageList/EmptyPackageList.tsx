import { SearchOff as NoResultIcon } from "@mui/icons-material"
import { Box, styled, Typography } from "@mui/material"

const Container = styled(Box)`
  align-items: center;
  display: flex;
  flex-direction: column;
  font-size: 40px;
  height: 100%;
  justify-content: center;
  width: "100%";
`

export function EmptyPackageList(): JSX.Element {
  return (
    <Container>
      <NoResultIcon fontSize="inherit" />
      <Typography variant="subtitle1">No packages found for these filters</Typography>
    </Container>
  )
}
