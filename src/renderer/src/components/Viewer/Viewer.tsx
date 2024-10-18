import { ReactNode } from "react"

import { Close as CloseIcon } from "@mui/icons-material"
import { Box, IconButton, Modal } from "@mui/material"

export interface ViewerProps {
  children: ReactNode
  onClose: () => void
  open: boolean
}

export function Viewer({ children, open, onClose }: ViewerProps): JSX.Element {
  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          borderRadius: 3,
          color: "white",
          height: 600,
          left: "50%",
          maxHeight: "90%",
          maxWidth: "90%",
          overflow: "hidden",
          position: "absolute",
          transform: "translate(-50%, -50%)",
          top: "50%",
          width: 800,
        }}
      >
        <IconButton
          color="inherit"
          onClick={onClose}
          sx={{
            backgroundColor: "black",
            opacity: 0.4,
            position: "absolute",
            right: 10,
            top: 10,
            transition: "200ms",
            zIndex: 2,
            "&:hover": {
              backgroundColor: "black",
              opacity: 0.6,
            },
          }}
        >
          <CloseIcon />
        </IconButton>
        {children}
      </Box>
    </Modal>
  )
}
