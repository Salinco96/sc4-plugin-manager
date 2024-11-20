import type { ReactNode } from "react"

import { Close as CloseIcon } from "@mui/icons-material"
import { Box, IconButton, Modal } from "@mui/material"

export interface ViewerProps {
  background?: "dark" | "light"
  children: ReactNode
  onClose: () => void
  open: boolean
}

export function Viewer({ background, children, open, onClose }: ViewerProps): JSX.Element {
  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          backgroundColor: background === "dark" ? "rgba(0, 0, 0, 0.9)" : "white",
          borderRadius: 3,
          color: background === "dark" ? "white" : undefined,
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
            backgroundColor: background === "dark" ? "black" : undefined,
            opacity: 0.4,
            position: "absolute",
            right: 10,
            top: 10,
            transition: "200ms",
            zIndex: 2,
            "&:hover": {
              backgroundColor: background === "dark" ? "black" : undefined,
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
