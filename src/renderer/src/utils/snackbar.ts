import type { EmptyRecord } from "@common/utils/types"

interface CustomProps {
  "download-progress": EmptyRecord
  "load-progress": EmptyRecord
}

export type SnackbarType = keyof CustomProps
export type SnackbarProps<Type extends SnackbarType> = CustomProps[Type]

declare module "notistack" {
  interface VariantOverrides extends CustomProps {}
}
