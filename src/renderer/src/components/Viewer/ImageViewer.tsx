import { Box } from "@mui/material"
import Carousel from "react-material-ui-carousel"

import { Viewer } from "./Viewer"

export interface ImageViewerProps {
  images: string[]
  onClose: () => void
  open: boolean
}

export function ImageViewer({ images, open, onClose }: ImageViewerProps): JSX.Element {
  return (
    <Viewer open={open} onClose={onClose}>
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
    </Viewer>
  )
}
