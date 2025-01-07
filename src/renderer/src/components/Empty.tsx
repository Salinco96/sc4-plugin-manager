import { SearchOff as NoResultIcon } from "@mui/icons-material"
import { Typography } from "@mui/material"
import { FlexBox } from "./FlexBox"

export function Empty({ message }: { message?: string }): JSX.Element {
  return (
    <FlexBox
      alignItems="center"
      direction="column"
      flex={1}
      fontSize={40}
      justifyContent="center"
      height="100%"
    >
      <NoResultIcon fontSize="inherit" />
      {message && <Typography variant="subtitle1">{message}</Typography>}
    </FlexBox>
  )
}
