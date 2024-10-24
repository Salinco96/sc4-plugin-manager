import { ContentCopy as CopyIcon } from "@mui/icons-material"
import { IconButton } from "@mui/material"

export interface CopyButtonProps {
  text: string
}

export function CopyButton({ text }: CopyButtonProps): JSX.Element {
  return (
    <IconButton
      onClick={() => navigator.clipboard.writeText(text)}
      size="small"
      title="Copy to clipboard"
    >
      <CopyIcon fontSize="inherit" />
    </IconButton>
  )
}
