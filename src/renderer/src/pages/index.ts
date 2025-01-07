import { type ComponentType, lazy } from "react"

import type { Page, PageData } from "@utils/navigation"

export const PageComponents: {
  [T in Page]: ComponentType<PageData<T>>
} = {
  Authors: lazy(() => import("./Authors")),
  AuthorView: lazy(() => import("./AuthorView")),
  Packages: lazy(() => import("./Packages")),
  PackageView: lazy(() => import("./PackageView")),
  Profile: lazy(() => import("./Profile")),
  Settings: lazy(() => import("./Settings")),
  Tools: lazy(() => import("./Tools")),
  ToolView: lazy(() => import("./ToolView")),
}
