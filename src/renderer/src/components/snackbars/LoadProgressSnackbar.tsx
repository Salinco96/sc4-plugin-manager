import { forwardRef, useEffect } from "react"

import { CardActions, Typography } from "@mui/material"
import CircularProgress from "@mui/material/CircularProgress"
import { CustomContentProps } from "notistack"

import { useStore, useStoreActions } from "@renderer/utils/store"

import { CustomSnackbar } from "./CustomSnackbar"

export const ProgressSnackbar = forwardRef<HTMLDivElement, CustomContentProps>((props, ref) => {
  const actions = useStoreActions()

  const message = useStore(store => store.loadStatus)

  useEffect(() => {
    if (!message) {
      // Clear after short duration to prevent closing and reopening for successive tasks
      const timeout = setTimeout(() => actions.closeSnackbar("load-progress"), 100)
      return () => clearTimeout(timeout)
    }
  }, [message])

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
