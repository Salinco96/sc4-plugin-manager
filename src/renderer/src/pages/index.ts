import { ComponentType, lazy } from "react"

export enum Page {
  Packages = "Packages",
  PackageView = "PackageView",
  Profile = "Profile",
  Settings = "Settings",
}

export type PageData<T extends Page> = {
  Packages: {}
  PackageView: { packageId: string }
  Profile: {}
  Settings: {}
}[T]

export const Packages = lazy(() => import("./Packages"))
export const PackageView = lazy(() => import("./PackageView"))
export const Profile = lazy(() => import("./Profile"))
export const Settings = lazy(() => import("./Settings"))

const PAGES: {
  [T in Page]: ComponentType<PageData<T>>
} = {
  Packages,
  PackageView,
  Profile,
  Settings,
}

export function getPageComponent<T extends Page>(page: T): ComponentType<PageData<T>> {
  return PAGES[page] as ComponentType<PageData<T>>
}
