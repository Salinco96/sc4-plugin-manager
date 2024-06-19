import {
  WidgetsOutlined as AllPackagesIcon,
  AccountBalance as CivicsIcon,
  CorporateFare as CommercialIcon,
  ViewInAr as DependenciesIcon,
  Bolt as EnergyIcon,
  Factory as IndustrialIcon,
  Church as LandmarksIcon,
  Extension as ModsIcon,
  LocalFlorist as ParksIcon,
  Report as ProblemsIcon,
  AccountBox as ProfileIcon,
  Apartment as ResidentialIcon,
  Settings as SettingsIcon,
  Traffic as TransportIcon,
  Update as UpdatesIcon,
} from "@mui/icons-material"

import { PackageCategory } from "@common/categories"
import { PackageState } from "@common/types"
import { Location, Page } from "@utils/navigation"
import { filterVariant } from "@utils/packages"
import { PackageFilters, Store, getCurrentProfile } from "@utils/store"

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

function countPackages(store: Store, overrideFilters?: Partial<PackageFilters>): number {
  const profileInfo = getCurrentProfile(store)

  const filters = {
    ...store.packageFilters,
    ...overrideFilters,
  }

  return store.packages
    ? Object.values(store.packages).filter(packageInfo =>
        Object.values(packageInfo.variants).some(variantInfo =>
          filterVariant(packageInfo, variantInfo, profileInfo, filters),
        ),
      ).length
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
      return countPackages(store, this.packageFilters)
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
      states: [],
    },
  },
  {
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
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
      states: [],
    },
    tooltip: "Textures, props",
  },
  {
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
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
      states: [],
    },
    tooltip: "Gameplay mods, bugfixes, DLLs",
  },
  {
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
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
      states: [],
    },
    tooltip: "Residential lots",
  },
  {
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
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
      states: [],
    },
    tooltip: "Commercial lots",
  },
  {
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
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
      states: [],
    },
    tooltip: "Industrial lots",
  },
  {
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
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
      states: [],
    },
    tooltip: "Civic buildings, rewards",
  },
  {
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
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
      states: [],
    },
    tooltip: "Landmarks",
  },
  {
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
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
      states: [],
    },
    tooltip: "Parks",
  },
  {
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
    },
    group: "Packages",
    icon: <EnergyIcon />,
    id: `packages:${PackageCategory.UTILITIES}`,
    label: "Utilities",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.UTILITIES],
      onlyErrors: false,
      onlyUpdates: false,
      states: [],
    },
    tooltip: "Energy, water, waste",
  },
  {
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
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
      states: [],
    },
    tooltip: "Transportation infrastructure",
  },
  {
    badgeColor: "error",
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
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
      states: [PackageState.ERROR],
    },
  },
  {
    badgeColor: "error",
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
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
      states: [PackageState.OUTDATED],
    },
    tooltip: "Packages with updates available",
  },
]

export const defaultTab = tabs[0]
