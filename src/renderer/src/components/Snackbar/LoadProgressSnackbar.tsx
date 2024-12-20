import { forwardRef, useEffect, useRef } from "react"

import { CardActions, CircularProgress, Typography } from "@mui/material"
import type { CustomContentProps } from "notistack"

import { useStore, useStoreActions } from "@utils/store"

import { CustomSnackbar } from "./CustomSnackbar"

export const ProgressSnackbar = forwardRef<HTMLDivElement, CustomContentProps>((props, ref) => {
  const actions = useStoreActions()

  const info = useStore(store => store.loader ?? store.linker)

  const message = info
    ? info.progress
      ? `${info.step} (${info.progress}%)`
      : info.step
    : undefined

  const lastMessageRef = useRef(message)

  useEffect(() => {
    if (message) {
      lastMessageRef.current = message
    } else {
      // Clear after short duration to prevent closing and reopening for successive tasks
      const timeout = setTimeout(() => actions.closeSnackbar("load-progress"), 100)
      return () => clearTimeout(timeout)
    }
  }, [actions, message])

  // Sometimes the action may be so fast that message will already be empty by the time we show the toast
  if (!message && !lastMessageRef.current) {
    return <div ref={ref} />
  }

  return (
    <CustomSnackbar {...props} ref={ref} sx={{ backgroundColor: "#313131", color: "#fff" }}>
      <CardActions>
        <CircularProgress color="inherit" size={16} />
        <Typography variant="body2">{message ?? lastMessageRef.current}</Typography>
      </CardActions>
    </CustomSnackbar>
  )
})

ProgressSnackbar.displayName = "ProgressSnackbar"
