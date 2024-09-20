import {
  Agriculture as AgricultureIcon,
  WidgetsOutlined as AllPackagesIcon,
  AccountBalance as CivicsIcon,
  CorporateFare as CommercialIcon,
  ViewInAr as DependenciesIcon,
  Bolt as EnergyIcon,
  Factory as IndustrialIcon,
  Church as LandmarksIcon,
  Extension as ModsIcon,
  NewReleases as NewIcon,
  LocalFlorist as ParksIcon,
  ReportProblem as ProblemsIcon,
  AccountBox as ProfileIcon,
  Apartment as ResidentialIcon,
  Settings as SettingsIcon,
  Traffic as TransportIcon,
  Update as UpdatesIcon,
} from "@mui/icons-material"

import { CategoryID } from "@common/categories"
import { PackageState } from "@common/types"
import { values } from "@common/utils/objects"
import { Location, Page } from "@utils/navigation"
import { filterVariant } from "@utils/packages"
import { PackageFilters, Store, getCurrentProfile } from "@utils/store"

export interface TabInfo {
  badgeColor?: "error" | "info"
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
  if (!store.packages) {
    return 0
  }

  const profileInfo = getCurrentProfile(store)

  const filters = {
    ...store.packageFilters,
    ...overrideFilters,
  }

  return values(store.packages).filter(packageInfo =>
    values(packageInfo.variants).some(variantInfo =>
      filterVariant(packageInfo, variantInfo, profileInfo, filters),
    ),
  ).length
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
      onlyNew: false,
      onlyUpdates: false,
      search: "",
      states: [],
    },
  },
  {
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
    },
    group: "Packages",
    icon: <DependenciesIcon />,
    id: "packages:dependencies",
    label: "Dependencies",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [CategoryID.DEPENDENCIES],
      onlyErrors: false,
      onlyNew: false,
      onlyUpdates: false,
      search: "",
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
    id: "packages:mods",
    label: "Mods",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [CategoryID.MODS],
      onlyErrors: false,
      onlyNew: false,
      onlyUpdates: false,
      search: "",
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
    id: "packages:residential",
    label: "Residential",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [CategoryID.RESIDENTIAL],
      onlyErrors: false,
      onlyNew: false,
      onlyUpdates: false,
      search: "",
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
    id: "packages:commercial",
    label: "Commercial",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [CategoryID.COMMERCIAL],
      onlyErrors: false,
      onlyNew: false,
      onlyUpdates: false,
      search: "",
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
    id: "packages:industry",
    label: "Industry",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [CategoryID.INDUSTRY],
      onlyErrors: false,
      onlyNew: false,
      onlyUpdates: false,
      search: "",
      states: [],
    },
    tooltip: "Industrial lots",
  },
  {
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
    },
    group: "Packages",
    icon: <AgricultureIcon />,
    id: "packages:agriculture",
    label: "Agriculture",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [CategoryID.AGRICULTURE],
      onlyErrors: false,
      onlyNew: false,
      onlyUpdates: false,
      search: "",
      states: [],
    },
    tooltip: "Agricultural lots",
  },
  {
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
    },
    group: "Packages",
    icon: <CivicsIcon />,
    id: "packages:civics",
    label: "Civics",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [CategoryID.CIVICS],
      onlyErrors: false,
      onlyNew: false,
      onlyUpdates: false,
      search: "",
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
    id: "packages:landmarks",
    label: "Landmarks",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [CategoryID.LANDMARKS],
      onlyErrors: false,
      onlyNew: false,
      onlyUpdates: false,
      search: "",
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
    id: "packages:parks",
    label: "Parks",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [CategoryID.PARKS],
      onlyErrors: false,
      onlyNew: false,
      onlyUpdates: false,
      search: "",
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
    id: "packages:utilities",
    label: "Utilities",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [CategoryID.UTILITIES],
      onlyErrors: false,
      onlyNew: false,
      onlyUpdates: false,
      search: "",
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
    id: "packages:transport",
    label: "Transport",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [CategoryID.TRANSPORT],
      onlyErrors: false,
      onlyNew: false,
      onlyUpdates: false,
      search: "",
      states: [],
    },
    tooltip: "Transportation infrastructure",
  },
  {
    badgeColor: "info",
    badgeCount(store) {
      return countPackages(store, this.packageFilters)
    },
    group: "Packages",
    icon: <NewIcon />,
    id: "packages:new",
    label: "New",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [],
      onlyErrors: false,
      onlyNew: true,
      onlyUpdates: false,
      search: "",
      states: [PackageState.NEW],
    },
    tooltip: "Newly-released packages",
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
      onlyNew: false,
      onlyUpdates: false,
      search: "",
      states: [PackageState.ERROR],
    },
    tooltip: "Packages with issues",
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
      onlyNew: false,
      onlyUpdates: true,
      search: "",
      states: [PackageState.OUTDATED],
    },
    tooltip: "Packages with updates available",
  },
]

export const defaultTab = tabs[0]
