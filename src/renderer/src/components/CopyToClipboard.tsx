import CopyIcon from "@mui/icons-material/ContentCopy"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import { enqueueSnackbar } from "notistack"

export function CopyToClipboard({ text }: { text: string }): JSX.Element {
  return (
    <Tooltip title="Copy to clipboard">
      <IconButton
        aria-label="Copy to clipboard"
        color="inherit"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            enqueueSnackbar("Copied to clipboard", {
              autoHideDuration: 2000,
              variant: "success",
            })
          } catch (error) {
            console.error(error)
          }
        }}
        size="small"
        sx={{ marginLeft: 1 }}
      >
        <CopyIcon />
      </IconButton>
    </Tooltip>
  )
}
