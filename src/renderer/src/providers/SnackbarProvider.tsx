import { ComponentType, ReactNode } from "react"

import { CustomContentProps, SnackbarProvider as BaseSnackbarProvider } from "notistack"

import { DownloadProgressSnackbar } from "@renderer/components/snackbars/DownloadProgressSnackbar"
import { ProgressSnackbar } from "@renderer/components/snackbars/LoadProgressSnackbar"

interface CustomProps {
  "download-progress": {}
  "load-progress": {}
}

export type SnackbarType = keyof CustomProps
export type SnackbarProps<Type extends SnackbarType> = CustomProps[Type]

declare module "notistack" {
  interface VariantOverrides extends CustomProps {}
}

const snackbarComponents: {
  [Type in SnackbarType]: ComponentType<CustomContentProps & SnackbarProps<Type>>
} = {
  "download-progress": DownloadProgressSnackbar,
  "load-progress": ProgressSnackbar,
}

export function SnackbarProvider({ children }: { children: ReactNode }): JSX.Element {
  return <BaseSnackbarProvider Components={snackbarComponents}>{children}</BaseSnackbarProvider>
}
