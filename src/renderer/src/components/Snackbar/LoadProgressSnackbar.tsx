import { CardActions, CircularProgress, Typography } from "@mui/material"
import type { CustomContentProps } from "notistack"
import { forwardRef, useEffect, useRef } from "react"

import { status } from "@stores/status"
import { closeSnackbar } from "@stores/ui"

import { CustomSnackbar } from "./CustomSnackbar"

export const ProgressSnackbar = forwardRef<HTMLDivElement, CustomContentProps>((props, ref) => {
  const message = status.useStore(status => {
    const task = status.loader ?? status.linker
    if (task) {
      return task.progress ? `${task.step} (${task.progress}%)` : task.step
    }
  })

  const lastMessageRef = useRef(message)
  useEffect(() => {
    if (message) {
      lastMessageRef.current = message
    } else {
      // Clear after short duration to prevent closing and reopening for successive tasks
      const timeout = setTimeout(() => closeSnackbar("load-progress"), 100)
      return () => clearTimeout(timeout)
    }
  }, [message])

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
