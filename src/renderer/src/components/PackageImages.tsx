import { Close as CloseIcon } from "@mui/icons-material"
import { Box, IconButton, Modal } from "@mui/material"
import Carousel from "react-material-ui-carousel"

export function PackageImages({
  images,
  open,
  onClose,
}: {
  images: string[]
  onClose: () => void
  open: boolean
}): JSX.Element {
  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          backgroundColor: "rgba(0, 0, 0, 0.8)",
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
        <Carousel
          autoPlay={false}
          fullHeightHover={false}
          height="100%"
          indicators={images.length > 1}
          navButtonsAlwaysInvisible={images.length < 2}
          sx={{
            height: "100%",
            paddingBottom: images.length > 1 ? 6 : 3,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 3,
            width: "100%",
          }}
        >
          {images.map(image => (
            <Box
              key={image}
              sx={{
                alignItems: "center",
                display: "flex",
                height: "100%",
                justifyContent: "center",
                overflow: "auto",
                width: "100%",
              }}
            >
              <Box
                sx={{
                  maxHeight: "100%",
                  maxWidth: "100%",
                }}
              >
                <img src={image} />
              </Box>
            </Box>
          ))}
        </Carousel>
      </Box>
    </Modal>
  )
}
