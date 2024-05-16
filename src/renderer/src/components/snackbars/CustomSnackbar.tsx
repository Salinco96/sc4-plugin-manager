import { ReactNode, forwardRef } from "react"

import Card from "@mui/material/Card"
import { styled } from "@mui/material/styles"
import { CustomContentProps, SnackbarContent } from "notistack"

const _CustomSnackbar = forwardRef<
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

_CustomSnackbar.displayName = "CustomSnackbar"

export const CustomSnackbar = styled(_CustomSnackbar)({})
