import { Box } from "@mui/material"

import { Viewer } from "./Viewer"

export interface TextViewerProps {
  onClose: () => void
  open: boolean
  text: string
}

export function TextViewer({ open, onClose, text }: TextViewerProps): JSX.Element {
  return (
    <Viewer open={open} onClose={onClose}>
      <Box sx={{ height: "100%", paddingX: 8, paddingY: 3, width: "100%" }}>
        <Box sx={{ height: "100%", overflow: "auto", width: "100%" }}>
          <pre>{text}</pre>
        </Box>
      </Box>
    </Viewer>
  )
}
