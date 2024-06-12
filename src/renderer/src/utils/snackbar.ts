interface CustomProps {
  "download-progress": {}
  "load-progress": {}
}

export type SnackbarType = keyof CustomProps
export type SnackbarProps<Type extends SnackbarType> = CustomProps[Type]

declare module "notistack" {
  interface VariantOverrides extends CustomProps {}
}
