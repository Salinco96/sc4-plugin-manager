import { Box, CardActions, LinearProgress, Typography } from "@mui/material"
import { keys } from "@salinco/nice-utils"
import type { CustomContentProps } from "notistack"
import { forwardRef, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { status } from "@stores/status"
import { closeSnackbar } from "@stores/ui"

import { CustomSnackbar } from "./CustomSnackbar"

export const DownloadProgressSnackbar = forwardRef<HTMLDivElement, CustomContentProps>(
  (props, ref) => {
    const { t } = useTranslation("Snackbar")

    const taskInfo = status.useShallow(state => {
      const key = keys(state.downloads)[0]
      if (key) {
        return { key, ...state.downloads[key] }
      }
    })

    const message = taskInfo && t("downloading", taskInfo)

    const lastMessageRef = useRef(message)
    useEffect(() => {
      if (message) {
        lastMessageRef.current = message
      } else {
        // Clear after short duration to prevent closing and reopening for successive downloads
        const timeout = setTimeout(() => closeSnackbar("download-progress"), 100)
        return () => clearTimeout(timeout)
      }
    }, [message])

    // Sometimes the action may be so fast that message will already be empty by the time we show the toast
    if (!message && !lastMessageRef.current) {
      return <div ref={ref} />
    }

    return (
      <CustomSnackbar
        {...props}
        ref={ref}
        sx={{
          backgroundColor: "#313131",
          color: "#fff",
          // maxWidth: hover ? 600 : 300,
          transition: "max-width 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        }}
      >
        <Box sx={{ paddingBottom: 0.75, paddingLeft: 1, paddingRight: 1, paddingTop: 0.5 }}>
          <CardActions sx={{ padding: 0, marginBottom: 0.5 }}>
            <Typography
              sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              variant="body2"
            >
              {message ?? lastMessageRef.current}
            </Typography>
          </CardActions>
          <LinearProgress
            sx={{ height: 2, justifySelf: "stretch" }}
            value={taskInfo?.progress}
            variant={taskInfo?.progress !== undefined ? "determinate" : "indeterminate"}
          />
        </Box>
      </CustomSnackbar>
    )
  },
)

DownloadProgressSnackbar.displayName = "DownloadProgressSnackbar"
