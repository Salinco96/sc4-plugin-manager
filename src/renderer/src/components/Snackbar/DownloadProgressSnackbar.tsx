import { forwardRef, useEffect, useRef } from "react"

import { Box, CardActions, LinearProgress, Typography } from "@mui/material"
import { CustomContentProps } from "notistack"

import { useStore, useStoreActions } from "@utils/store"

import { CustomSnackbar } from "./CustomSnackbar"

export const DownloadProgressSnackbar = forwardRef<HTMLDivElement, CustomContentProps>(
  (props, ref) => {
    const actions = useStoreActions()

    // const [hover, setHover] = useState(false)

    const message = useStore(store => {
      if (store.status?.ongoingDownloads.length) {
        const { key, progress } = store.status.ongoingDownloads[0]
        return `Downloading ${key}${progress !== undefined ? ` (${progress}%)` : ""}...`
      }

      if (store.status?.ongoingExtracts.length) {
        const { key, progress } = store.status.ongoingExtracts[0]
        return `Extracting ${key}${progress !== undefined ? ` (${progress}%)` : ""}...`
      }
    })

    const progress = useStore(store => {
      if (store.status?.ongoingDownloads.length) {
        return store.status.ongoingDownloads[0].progress
      }

      if (store.status?.ongoingExtracts.length) {
        return store.status.ongoingExtracts[0].progress
      }
    })

    const lastMessageRef = useRef(message)

    useEffect(() => {
      if (message) {
        lastMessageRef.current = message
      } else {
        // Clear after short duration to prevent closing and reopening for successive downloads
        const timeout = setTimeout(() => actions.closeSnackbar("download-progress"), 100)
        return () => clearTimeout(timeout)
      }
    }, [message])

    // Sometimes the action may be so fast that message will already be empty by the time we show the toast
    if (!message && !lastMessageRef.current) {
      return <div ref={ref}></div>
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
        <Box
          // onMouseEnter={() => setHover(true)}
          // onMouseLeave={() => setHover(false)}
          sx={{ paddingBottom: 0.75, paddingLeft: 1, paddingRight: 1, paddingTop: 0.5 }}
        >
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
            value={progress}
            variant={progress !== undefined ? "determinate" : "indeterminate"}
          />
        </Box>
      </CustomSnackbar>
    )
  },
)

DownloadProgressSnackbar.displayName = "DownloadProgressSnackbar"
