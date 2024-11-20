import type { ComponentType } from "react"

import type { CustomContentProps } from "notistack"

import type { SnackbarProps, SnackbarType } from "@utils/snackbar"

import { DownloadProgressSnackbar } from "./DownloadProgressSnackbar"
import { ProgressSnackbar } from "./LoadProgressSnackbar"

export const SnackbarComponents: {
  [Type in SnackbarType]: ComponentType<CustomContentProps & SnackbarProps<Type>>
} = {
  "download-progress": DownloadProgressSnackbar,
  "load-progress": ProgressSnackbar,
}
