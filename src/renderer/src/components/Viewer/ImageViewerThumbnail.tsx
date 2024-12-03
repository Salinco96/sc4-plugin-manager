import { useState } from "react"

import { Thumbnail, type ThumbnailProps } from "@components/Thumbnail"

import { ImageViewer } from "./ImageViewer"

export interface ImageViewerThumbnailProps extends Omit<ThumbnailProps, "src" | "onClick"> {
  images: string[]
}

export function ImageViewerThumbnail({ images, ...props }: ImageViewerThumbnailProps): JSX.Element {
  const [isOpenImages, setOpenImages] = useState(false)

  return (
    <>
      <ImageViewer images={images} onClose={() => setOpenImages(false)} open={isOpenImages} />
      <Thumbnail onClick={() => setOpenImages(true)} src={images[0]} {...props} />
    </>
  )
}
