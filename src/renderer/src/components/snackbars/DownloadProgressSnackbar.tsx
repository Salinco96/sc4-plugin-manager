import { forwardRef, useEffect } from "react"

import { CardActions, Typography } from "@mui/material"
import CircularProgress from "@mui/material/CircularProgress"
import { CustomContentProps, closeSnackbar } from "notistack"

import { useStore } from "@renderer/utils/store"

import { CustomSnackbar } from "./CustomSnackbar"

export const DownloadProgressSnackbar = forwardRef<HTMLDivElement, CustomContentProps>(
  (props, ref) => {
    const { id } = props

    const key = useStore(store => store.ongoingDownloads[0])

    useEffect(() => {
      if (!key) {
        closeSnackbar(id)
      }
    }, [id, key])

    return (
      <CustomSnackbar {...props} ref={ref} sx={{ backgroundColor: "#313131", color: "#fff" }}>
        <CardActions>
          <CircularProgress color="inherit" size={16} />
          <Typography variant="body2">Downloading {key}...</Typography>
        </CardActions>
      </CustomSnackbar>
    )
  },
)

DownloadProgressSnackbar.displayName = "DownloadProgressSnackbar"
