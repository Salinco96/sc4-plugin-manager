import { type ComponentType, lazy } from "react"

import type { Page, PageData } from "@utils/navigation"

export const PageComponents: {
  [T in Page]: ComponentType<PageData<T>>
} = {
  Authors: lazy(() => import("./Authors")),
  AuthorView: lazy(() => import("./AuthorView")),
  CityView: lazy(() => import("./CityView")),
  Collections: lazy(() => import("./Collections")),
  CollectionView: lazy(() => import("./CollectionView")),
  Packages: lazy(() => import("./Packages")),
  PackageView: lazy(() => import("./PackageView")),
  Profile: lazy(() => import("./Profile")),
  Regions: lazy(() => import("./Regions")),
  RegionView: lazy(() => import("./RegionView")),
  Settings: lazy(() => import("./Settings")),
  Tools: lazy(() => import("./Tools")),
  ToolView: lazy(() => import("./ToolView")),
}
