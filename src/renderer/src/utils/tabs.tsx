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
  InsertDriveFile as PluginsIcon,
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
import {
  type MainState,
  type PackageFilters,
  getCurrentProfile,
  getCurrentVariant,
} from "@stores/main"
import { type Location, Page } from "@utils/navigation"
import { filterVariant } from "@utils/packages"

export interface BadgeInfo {
  color?: "error" | "info" | "warning"
  icon?: "error"
  label: number | string
}

export interface TabInfo {
  badge?: (state: MainState) => BadgeInfo | undefined
  collapse?: boolean
  group?: string
  icon?: JSX.Element
  id: string
  label: string
  location: Location
  packageFilters?: Partial<PackageFilters>
  tooltip?: string
}

function countPackages(state: MainState, overrideFilters?: Partial<PackageFilters>): number {
  if (!state.packages) {
    return 0
  }

  const profileInfo = getCurrentProfile(state)

  const filters = {
    ...state.packageFilters,
    ...overrideFilters,
  }

  return values(state.packages).filter(packageInfo => {
    if (filters.onlyErrors) {
      // Only check errors for the selected variant
      const packageStatus = getPackageStatus(packageInfo, profileInfo)
      const variantInfo = getCurrentVariant(state, packageInfo.id)
      if (filters.onlyErrors && !isError(variantInfo, packageStatus)) {
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
    badge(state) {
      return { label: size(state.authors) }
    },
    icon: <AuthorsIcon />,
    id: "authors",
    label: "Authors",
    location: { page: Page.Authors, data: {} },
  },
  {
    badge(state) {
      const tools = state.tools && values(state.tools).filter(tool => !tool?.disabled)

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
    badge(state) {
      const regions = state.regions && values(state.regions)

      if (
        state.profiles &&
        size(state.profiles) > 1 &&
        regions?.some(
          region => !getRegionLinkedProfileId(region.id, state.settings, state.profiles),
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
    badge(state) {
      if (state.plugins) {
        return { label: size(state.plugins) }
      }
    },
    icon: <PluginsIcon />,
    id: "plugins",
    label: "Plugins",
    location: { page: Page.Plugins, data: {} },
  },
  {
    badge(state) {
      const count = countPackages(state, this.packageFilters)

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
    badge(state) {
      const count = countPackages(state, this.packageFilters)

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
    badge(state) {
      const count = countPackages(state, this.packageFilters)

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
    badge(state) {
      const count = countPackages(state, this.packageFilters)

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
    badge(state) {
      const count = countPackages(state, this.packageFilters)

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
    badge(state) {
      const count = countPackages(state, this.packageFilters)

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
    badge(state) {
      const count = countPackages(state, this.packageFilters)

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
    badge(state) {
      const count = countPackages(state, this.packageFilters)

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
    badge(state) {
      const count = countPackages(state, this.packageFilters)

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
    badge(state) {
      const count = countPackages(state, this.packageFilters)

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
    badge(state) {
      const count = countPackages(state, this.packageFilters)

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
    badge(state) {
      const count = countPackages(state, this.packageFilters)

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
    badge(state) {
      const collections = state.collections && values(state.collections)

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
    badge(state) {
      const count = countPackages(state, this.packageFilters)

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
    badge(state) {
      const count = countPackages(state, this.packageFilters)

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
    badge(state) {
      const count = countPackages(state, this.packageFilters)

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
