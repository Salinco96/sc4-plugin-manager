import {
  AccountBalance as CivicsIcon,
  AccountBox as ProfileIcon,
  Apartment as ResidentialIcon,
  Bolt as EnergyIcon,
  Church as LandmarksIcon,
  CorporateFare as CommercialIcon,
  Extension as ModsIcon,
  Factory as IndustrialIcon,
  LocalFlorist as ParksIcon,
  Report as ProblemsIcon,
  Settings as SettingsIcon,
  Traffic as TransportIcon,
  Update as UpdatesIcon,
  ViewInAr as DependenciesIcon,
  WidgetsOutlined as AllPackagesIcon,
} from "@mui/icons-material"

import { PackageCategory, PackageState, getCategory, getState } from "@common/types"
import { Page } from "@renderer/pages"
import { Location } from "@renderer/utils/navigation"
import { PackageFilters, Store, getCurrentProfile } from "@renderer/utils/store"

export interface TabInfo {
  badgeColor?: "error"
  badgeCount?: (store: Store) => number | undefined
  group?: string
  icon?: JSX.Element
  id: string
  label: string
  location: Location
  packageFilters?: Partial<PackageFilters>
  tooltip?: string
}

function countPackages(store: Store, category?: PackageCategory, state?: PackageState): number {
  const profile = getCurrentProfile(store)
  return store.packages
    ? Object.values(store.packages).filter(info => {
        const variantInfo = info.variants[info.status.variantId]

        if (category && getCategory(variantInfo) !== category) {
          return false
        }

        if (state && !getState(info, state, profile)) {
          return false
        }

        if (store.packageFilters.state && !getState(info, store.packageFilters.state, profile)) {
          return false
        }

        if (!state) {
          if (
            !store.packageFilters.dependencies &&
            getCategory(variantInfo) === PackageCategory.DEPENDENCIES
          ) {
            return false
          }

          if (
            !store.packageFilters.incompatible &&
            getState(info, PackageState.INCOMPATIBLE, profile)
          ) {
            return false
          }
        }

        return true
      }).length
    : 0
}

export const tabs: TabInfo[] = [
  {
    icon: <ProfileIcon />,
    id: "profile",
    label: "Profile",
    location: { page: Page.Profile, data: {} },
  },
  {
    icon: <SettingsIcon />,
    id: "settings",
    label: "Settings",
    location: { page: Page.Settings, data: {} },
  },
  {
    badgeCount(store) {
      return countPackages(store)
    },
    group: "Packages",
    icon: <AllPackagesIcon />,
    id: "packages:all",
    label: "All",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [],
      onlyErrors: false,
      onlyUpdates: false,
    },
  },
  {
    badgeCount(store) {
      return countPackages(store, PackageCategory.DEPENDENCIES)
    },
    group: "Packages",
    icon: <DependenciesIcon />,
    id: `packages:${PackageCategory.DEPENDENCIES}`,
    label: "Dependencies",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.DEPENDENCIES],
      onlyErrors: false,
      onlyUpdates: false,
    },
    tooltip: "Textures, props",
  },
  {
    badgeCount(store) {
      return countPackages(store, PackageCategory.MODS)
    },
    group: "Packages",
    icon: <ModsIcon />,
    id: `packages:${PackageCategory.MODS}`,
    label: "Mods",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.MODS],
      onlyErrors: false,
      onlyUpdates: false,
    },
    tooltip: "Gameplay mods, bugfixes, DLLs",
  },
  {
    badgeCount(store) {
      return countPackages(store, PackageCategory.RESIDENTIAL)
    },
    group: "Packages",
    icon: <ResidentialIcon />,
    id: `packages:${PackageCategory.RESIDENTIAL}`,
    label: "Residential",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.RESIDENTIAL],
      onlyErrors: false,
      onlyUpdates: false,
    },
    tooltip: "Residential lots",
  },
  {
    badgeCount(store) {
      return countPackages(store, PackageCategory.COMMERCIAL)
    },
    group: "Packages",
    icon: <CommercialIcon />,
    id: `packages:${PackageCategory.COMMERCIAL}`,
    label: "Commercial",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.COMMERCIAL],
      onlyErrors: false,
      onlyUpdates: false,
    },
    tooltip: "Commercial lots",
  },
  {
    badgeCount(store) {
      return countPackages(store, PackageCategory.INDUSTRIAL)
    },
    group: "Packages",
    icon: <IndustrialIcon />,
    id: `packages:${PackageCategory.INDUSTRIAL}`,
    label: "Industrial",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.INDUSTRIAL],
      onlyErrors: false,
      onlyUpdates: false,
    },
    tooltip: "Industrial lots",
  },
  {
    badgeCount(store) {
      return countPackages(store, PackageCategory.CIVICS)
    },
    group: "Packages",
    icon: <CivicsIcon />,
    id: `packages:${PackageCategory.CIVICS}`,
    label: "Civics",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.CIVICS],
      onlyErrors: false,
      onlyUpdates: false,
    },
    tooltip: "Civic buildings, rewards",
  },
  {
    badgeCount(store) {
      return countPackages(store, PackageCategory.LANDMARKS)
    },
    group: "Packages",
    icon: <LandmarksIcon />,
    id: `packages:${PackageCategory.LANDMARKS}`,
    label: "Landmarks",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.LANDMARKS],
      onlyErrors: false,
      onlyUpdates: false,
    },
    tooltip: "Landmarks",
  },
  {
    badgeCount(store) {
      return countPackages(store, PackageCategory.PARKS)
    },
    group: "Packages",
    icon: <ParksIcon />,
    id: `packages:${PackageCategory.PARKS}`,
    label: "Parks",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.PARKS],
      onlyErrors: false,
      onlyUpdates: false,
    },
    tooltip: "Parks",
  },
  {
    badgeCount(store) {
      return countPackages(store, PackageCategory.ENERGY)
    },
    group: "Packages",
    icon: <EnergyIcon />,
    id: `packages:${PackageCategory.ENERGY}`,
    label: "Energy",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.ENERGY],
      onlyErrors: false,
      onlyUpdates: false,
    },
    tooltip: "Energy infrastructure",
  },
  {
    badgeCount(store) {
      return countPackages(store, PackageCategory.TRANSPORT)
    },
    group: "Packages",
    icon: <TransportIcon />,
    id: `packages:${PackageCategory.TRANSPORT}`,
    label: "Transport",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.TRANSPORT],
      onlyErrors: false,
      onlyUpdates: false,
    },
    tooltip: "Transportation infrastructure",
  },
  {
    badgeColor: "error",
    badgeCount(store) {
      return countPackages(store, undefined, PackageState.ERROR)
    },
    group: "Packages",
    icon: <ProblemsIcon />,
    id: "packages:errors",
    label: "Problems",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [],
      onlyErrors: true,
      onlyUpdates: false,
    },
  },
  {
    badgeColor: "error",
    badgeCount(store) {
      return countPackages(store, undefined, PackageState.OUTDATED)
    },
    group: "Packages",
    icon: <UpdatesIcon />,
    id: "packages:updates",
    label: "Updates",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [],
      onlyErrors: false,
      onlyUpdates: true,
    },
    tooltip: "Packages with updates available",
  },
]

export const defaultTab = tabs[0]
