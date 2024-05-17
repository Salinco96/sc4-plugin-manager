import { ComponentType, ReactNode } from "react"

import { CustomContentProps, SnackbarProvider as BaseSnackbarProvider } from "notistack"

import { DownloadProgressSnackbar } from "@renderer/components/snackbars/DownloadProgressSnackbar"

import { ProgressSnackbar } from "../components/snackbars/LoadProgressSnackbar"

interface CustomProps {
  "download-progress": {}
  "load-progress": {}
}

declare module "notistack" {
  interface VariantOverrides extends CustomProps {}
}

const snackbarComponents: {
  [variant in keyof CustomProps]: ComponentType<CustomContentProps & CustomProps[variant]>
} = {
  "download-progress": DownloadProgressSnackbar,
  "load-progress": ProgressSnackbar,
}

export function SnackbarProvider({ children }: { children: ReactNode }): JSX.Element {
  return <BaseSnackbarProvider Components={snackbarComponents}>{children}</BaseSnackbarProvider>
}
