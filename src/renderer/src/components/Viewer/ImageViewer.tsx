import Carousel from "react-material-ui-carousel"

import { FlexBox } from "@components/FlexBox"
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
        {images.map((image, index) => (
          <FlexBox centered fullHeight fullWidth key={image} overflow="auto">
            <FlexBox centered fullHeight fullWidth>
              <img
                alt={`${index + 1} / ${images.length}`}
                src={image}
                style={{ objectFit: "contain", maxWidth: "100%", maxHeight: "100%" }}
                title={`${index + 1} / ${images.length}`}
              />
            </FlexBox>
          </FlexBox>
        ))}
      </Carousel>
    </Viewer>
  )
}
