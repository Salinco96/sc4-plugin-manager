import { forwardRef, useEffect } from "react"

import { CardActions, Typography } from "@mui/material"
import CircularProgress from "@mui/material/CircularProgress"
import { CustomContentProps, closeSnackbar } from "notistack"

import { useStore } from "@renderer/utils/store"

import { CustomSnackbar } from "./CustomSnackbar"

export const ProgressSnackbar = forwardRef<HTMLDivElement, CustomContentProps>((props, ref) => {
  const { id } = props

  const message = useStore(store => {
    if (props.message) {
      return props.message
    }

    if (store.profiles === undefined) {
      return "Loading profiles..."
    }

    if (store.settings === undefined) {
      return "Loading settings..."
    }

    if (store.collections === undefined) {
      return "Loading collections..."
    }

    if (store.localPackages === undefined) {
      return "Loading packages..."
    }

    if (store.remotePackages === undefined) {
      return "Loading packages..."
    }
  })

  useEffect(() => {
    if (!message) {
      closeSnackbar(id)
    }
  }, [id, message])

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
