import { forwardRef, useEffect } from "react"

import { CardActions, CircularProgress, Typography } from "@mui/material"
import { CustomContentProps } from "notistack"

import { useStore, useStoreActions } from "@renderer/utils/store"

import { CustomSnackbar } from "./CustomSnackbar"

export const ProgressSnackbar = forwardRef<HTMLDivElement, CustomContentProps>((props, ref) => {
  const actions = useStoreActions()

  const message = useStore(store => store.status?.loader ?? store.status?.linker)

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
