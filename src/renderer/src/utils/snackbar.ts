import type { EmptyRecord } from "@salinco/nice-utils"

interface CustomProps {
  "download-progress": EmptyRecord
  "load-progress": EmptyRecord
}

export type SnackbarType = keyof CustomProps
export type SnackbarProps<Type extends SnackbarType> = CustomProps[Type]

declare module "notistack" {
  interface VariantOverrides extends CustomProps {}
}
