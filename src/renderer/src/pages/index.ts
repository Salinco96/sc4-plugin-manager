import { ComponentType, lazy } from "react"

import { Page, PageData } from "@utils/navigation"

export const PageComponents: {
  [T in Page]: ComponentType<PageData<T>>
} = {
  Packages: lazy(() => import("./Packages")),
  PackageView: lazy(() => import("./PackageView")),
  Profile: lazy(() => import("./Profile")),
  Settings: lazy(() => import("./Settings")),
}
