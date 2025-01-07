import {
  Agriculture as AgricultureIcon,
  WidgetsOutlined as AllPackagesIcon,
  Person as AuthorsIcon,
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
  Construction as ToolsIcon,
  Traffic as TransportIcon,
  Update as UpdatesIcon,
} from "@mui/icons-material"
import { size, values } from "@salinco/nice-utils"

import { CategoryID } from "@common/categories"
import { getPackageStatus, isError } from "@common/packages"
import { VariantState } from "@common/types"
import { type Location, Page } from "@utils/navigation"
import { filterVariant, getCurrentVariant } from "@utils/packages"
import { type PackageFilters, type Store, getCurrentProfile } from "@utils/store"

export interface TabInfo {
  badgeColor?: "error" | "info"
  badgeCount?: (store: Store) => number | undefined
  collapse?: boolean
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

  return values(store.packages).filter(packageInfo => {
    if (filters.onlyErrors) {
      // Only check errors for the selected variant
      const packageStatus = getPackageStatus(packageInfo, profileInfo)
      const selectedVariant = getCurrentVariant(store, packageInfo.id)
      if (filters.onlyErrors && !isError(selectedVariant, packageStatus)) {
        return false
      }
    }

    return values(packageInfo.variants).some(variantInfo =>
      filterVariant(packageInfo, variantInfo, profileInfo, filters),
    )
  }).length
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
      return store.tools && Object.values(store.tools).filter(tool => !tool?.disabled).length
    },
    icon: <ToolsIcon />,
    id: "tools",
    label: "Tools",
    location: { page: Page.Tools, data: {} },
  },
  {
    badgeCount(store) {
      return size(store.authors)
    },
    icon: <AuthorsIcon />,
    id: "authors",
    label: "Authors",
    location: { page: Page.Authors, data: {} },
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
    collapse: true,
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
    collapse: true,
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
    collapse: true,
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
    collapse: true,
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
    collapse: true,
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
    collapse: true,
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
    collapse: true,
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
    collapse: true,
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
    collapse: true,
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
    collapse: true,
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
    collapse: true,
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
      states: [VariantState.NEW],
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
      states: [VariantState.ERROR],
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
      states: [VariantState.OUTDATED],
    },
    tooltip: "Packages with updates available",
  },
]

export const defaultTab = tabs[0]
