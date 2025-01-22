import {
  Agriculture as AgricultureIcon,
  WidgetsOutlined as AllPackagesIcon,
  Person as AuthorsIcon,
  AccountBalance as CivicsIcon,
  Collections as CollectionsIcon,
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
  Map as RegionsIcon,
  Apartment as ResidentialIcon,
  Settings as SettingsIcon,
  Construction as ToolsIcon,
  Traffic as TransportIcon,
  Update as UpdatesIcon,
} from "@mui/icons-material"
import { size, values } from "@salinco/nice-utils"

import { CategoryID } from "@common/categories"
import { getPackageStatus, isError } from "@common/packages"
import { getRegionLinkedProfileId } from "@common/regions"
import { VariantState } from "@common/types"
import { type Location, Page } from "@utils/navigation"
import { filterVariant, getCurrentVariant } from "@utils/packages"
import { type PackageFilters, type Store, getCurrentProfile } from "@utils/store"

export interface BadgeInfo {
  color?: "error" | "info" | "warning"
  icon?: "error"
  label: number | string
}

export interface TabInfo {
  badge?: (store: Store) => BadgeInfo | undefined
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
    badge(store) {
      return { label: size(store.authors) }
    },
    icon: <AuthorsIcon />,
    id: "authors",
    label: "Authors",
    location: { page: Page.Authors, data: {} },
  },
  {
    badge(store) {
      const tools = store.tools && values(store.tools).filter(tool => !tool?.disabled)

      if (tools?.some(tool => tool.new)) {
        return { color: "info", label: "new" }
      }

      if (tools?.length) {
        return { label: tools.length }
      }
    },
    icon: <ToolsIcon />,
    id: "tools",
    label: "Tools",
    location: { page: Page.Tools, data: {} },
  },
  {
    badge(store) {
      const regions = store.regions && values(store.regions)

      if (
        store.profiles &&
        size(store.profiles) > 1 &&
        regions?.some(
          region => !getRegionLinkedProfileId(region.id, store.settings, store.profiles),
        )
      ) {
        return { color: "warning", icon: "error", label: "Some regions have no linked profile" }
      }

      if (regions?.length) {
        return { label: regions.length }
      }
    },
    icon: <RegionsIcon />,
    id: "regions",
    label: "Regions",
    location: { page: Page.Regions, data: {} },
  },
  {
    badge(store) {
      const count = countPackages(store, this.packageFilters)

      if (count) {
        return { label: count }
      }
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
    badge(store) {
      const count = countPackages(store, this.packageFilters)

      if (count) {
        return { label: count }
      }
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
    badge(store) {
      const count = countPackages(store, this.packageFilters)

      if (count) {
        return { label: count }
      }
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
    badge(store) {
      const count = countPackages(store, this.packageFilters)

      if (count) {
        return { label: count }
      }
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
    badge(store) {
      const count = countPackages(store, this.packageFilters)

      if (count) {
        return { label: count }
      }
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
    badge(store) {
      const count = countPackages(store, this.packageFilters)

      if (count) {
        return { label: count }
      }
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
    badge(store) {
      const count = countPackages(store, this.packageFilters)

      if (count) {
        return { label: count }
      }
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
    badge(store) {
      const count = countPackages(store, this.packageFilters)

      if (count) {
        return { label: count }
      }
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
    badge(store) {
      const count = countPackages(store, this.packageFilters)

      if (count) {
        return { label: count }
      }
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
    badge(store) {
      const count = countPackages(store, this.packageFilters)

      if (count) {
        return { label: count }
      }
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
    badge(store) {
      const count = countPackages(store, this.packageFilters)

      if (count) {
        return { label: count }
      }
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
    badge(store) {
      const count = countPackages(store, this.packageFilters)

      if (count) {
        return { label: count }
      }
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
    badge(store) {
      const collections = store.collections && values(store.collections)

      if (collections?.some(collection => collection.new)) {
        return { color: "info", label: "new" }
      }

      if (collections?.length) {
        return { label: collections.length }
      }
    },
    group: "Packages",
    icon: <CollectionsIcon />,
    id: "collections",
    label: "Collections",
    location: { page: Page.Collections, data: {} },
  },
  {
    badge(store) {
      const count = countPackages(store, this.packageFilters)

      if (count) {
        return { color: "info", label: count }
      }
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
    badge(store) {
      const count = countPackages(store, this.packageFilters)

      if (count) {
        return { color: "error", label: count }
      }
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
    badge(store) {
      const count = countPackages(store, this.packageFilters)

      if (count) {
        return { color: "error", label: count }
      }
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
