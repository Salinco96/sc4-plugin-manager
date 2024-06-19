import { ReactNode, forwardRef } from "react"

import { Card, styled } from "@mui/material"
import { CustomContentProps, SnackbarContent } from "notistack"

const Snackbar = forwardRef<
  HTMLDivElement,
  CustomContentProps & { backgroundColor?: string; children: ReactNode }
>((props, ref) => {
  return (
    <SnackbarContent ref={ref} style={props.style} role="alert">
      <Card className={props.className} sx={{ padding: "6px 8px 6px 8px", width: "100%" }}>
        {props.children}
      </Card>
    </SnackbarContent>
  )
})

Snackbar.displayName = "CustomSnackbar"

export const CustomSnackbar = styled(Snackbar)({})
