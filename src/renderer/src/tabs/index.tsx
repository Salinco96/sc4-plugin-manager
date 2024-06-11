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
import { TagType } from "@renderer/components/PackageList/utils"
import { Page } from "@renderer/pages"
import { Location } from "@renderer/utils/navigation"
import { getCurrentVariant } from "@renderer/utils/packages"
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
        const variantInfo = getCurrentVariant(info, profile)

        if (category && getCategory(variantInfo) !== category) {
          return false
        }

        if (state && !getState(state, info, variantInfo.id, profile)) {
          return false
        }

        if (
          store.packageFilters.state &&
          !getState(store.packageFilters.state, info, variantInfo.id, profile)
        ) {
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
            getState(PackageState.INCOMPATIBLE, info, variantInfo.id, profile)
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
      onlyErrors: false,
      onlyUpdates: false,
      tags: [],
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
      onlyErrors: false,
      onlyUpdates: false,
      tags: [`${TagType.CATEGORY}:${PackageCategory.DEPENDENCIES}`],
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
      onlyErrors: false,
      onlyUpdates: false,
      tags: [`${TagType.CATEGORY}:${PackageCategory.MODS}`],
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
      onlyErrors: false,
      onlyUpdates: false,
      tags: [`${TagType.CATEGORY}:${PackageCategory.RESIDENTIAL}`],
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
      onlyErrors: false,
      onlyUpdates: false,
      tags: [`${TagType.CATEGORY}:${PackageCategory.COMMERCIAL}`],
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
      onlyErrors: false,
      onlyUpdates: false,
      tags: [`${TagType.CATEGORY}:${PackageCategory.INDUSTRIAL}`],
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
      onlyErrors: false,
      onlyUpdates: false,
      tags: [`${TagType.CATEGORY}:${PackageCategory.CIVICS}`],
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
      onlyErrors: false,
      onlyUpdates: false,
      tags: [`${TagType.CATEGORY}:${PackageCategory.LANDMARKS}`],
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
      onlyErrors: false,
      onlyUpdates: false,
      tags: [`${TagType.CATEGORY}:${PackageCategory.PARKS}`],
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
      onlyErrors: false,
      onlyUpdates: false,
      tags: [`${TagType.CATEGORY}:${PackageCategory.ENERGY}`],
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
      onlyErrors: false,
      onlyUpdates: false,
      tags: [`${TagType.CATEGORY}:${PackageCategory.TRANSPORT}`],
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
      onlyErrors: true,
      onlyUpdates: false,
      tags: [],
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
      onlyErrors: false,
      onlyUpdates: true,
      tags: [],
    },
    tooltip: "Packages with updates available",
  },
]

export const defaultTab = tabs[0]
