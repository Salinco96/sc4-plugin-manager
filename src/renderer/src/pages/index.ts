import { ComponentProps, ComponentType, lazy } from "react"

export type Page = keyof typeof PAGES

export type PageData<T extends Page> = ComponentProps<(typeof PAGES)[T]> & {}

export const Packages = lazy(() => import("./Packages"))
export const PackageView = lazy(() => import("./PackageView"))
export const Profile = lazy(() => import("./Profile"))
export const Settings = lazy(() => import("./Settings"))

const PAGES = {
  Packages,
  PackageView,
  Profile,
  Settings,
}

export function getPageComponent<T extends Page>(page: T): ComponentType<PageData<T>> {
  return PAGES[page] as ComponentType<PageData<T>>
}
