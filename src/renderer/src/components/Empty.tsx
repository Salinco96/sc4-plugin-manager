import { SearchOff as NoResultIcon } from "@mui/icons-material"
import { Typography } from "@mui/material"

import type { ReactNode } from "react"
import { FlexBox, FlexRow } from "./FlexBox"

export function Empty({
  children,
  message,
}: {
  children?: ReactNode
  message?: string
}): JSX.Element {
  return (
    <FlexBox centered direction="column" flex={1} fontSize={40} fullHeight>
      <FlexRow centered>
        <NoResultIcon fontSize="inherit" />
        {message && <Typography variant="subtitle1">{message}</Typography>}
      </FlexRow>
      {children}
    </FlexBox>
  )
}
