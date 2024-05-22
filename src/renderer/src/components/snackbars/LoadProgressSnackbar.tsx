import { forwardRef } from "react"

import { CardActions, Typography } from "@mui/material"
import CircularProgress from "@mui/material/CircularProgress"
import { CustomContentProps } from "notistack"

import { useStore } from "@renderer/utils/store"

import { CustomSnackbar } from "./CustomSnackbar"

export const ProgressSnackbar = forwardRef<HTMLDivElement, CustomContentProps>((props, ref) => {
  const message = useStore(store => store.loadStatus)

  return (
    <CustomSnackbar {...props} ref={ref} sx={{ backgroundColor: "#313131", color: "#fff" }}>
      <CardActions>
        <CircularProgress color="inherit" size={16} />
        <Typography variant="body2">{message}</Typography>
      </CardActions>
    </CustomSnackbar>
  )
})

ProgressSnackbar.displayName = "ProgressSnackbar"
