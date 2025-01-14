import { SearchOff as NoResultIcon } from "@mui/icons-material"
import { Typography } from "@mui/material"

import { FlexBox } from "./FlexBox"

export function Empty({ message }: { message?: string }): JSX.Element {
  return (
    <FlexBox centered flex={1} fontSize={40} fullHeight>
      <NoResultIcon fontSize="inherit" />
      {message && <Typography variant="subtitle1">{message}</Typography>}
    </FlexBox>
  )
}
