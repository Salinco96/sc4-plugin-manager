import CivicsIcon from "@mui/icons-material/AccountBalance"
import ProfileIcon from "@mui/icons-material/AccountBox"
import ResidentialIcon from "@mui/icons-material/Apartment"
import EnergyIcon from "@mui/icons-material/Bolt"
import LandmarksIcon from "@mui/icons-material/Church"
import CommercialIcon from "@mui/icons-material/CorporateFare"
import ModsIcon from "@mui/icons-material/Extension"
import IndustrialIcon from "@mui/icons-material/Factory"
import ParksIcon from "@mui/icons-material/LocalFlorist"
import ProblemsIcon from "@mui/icons-material/Report"
import SettingsIcon from "@mui/icons-material/Settings"
import TransportIcon from "@mui/icons-material/Traffic"
import DependenciesIcon from "@mui/icons-material/ViewInAr"
import AllPackagesIcon from "@mui/icons-material/WidgetsOutlined"

import { PackageCategory, PackageState } from "@common/types"
import { Page } from "@renderer/pages"
import { Location } from "@renderer/stores/navigation"

export interface TabInfo {
  group?: string
  icon?: JSX.Element
  id: string
  label: string
  location: Location
  packageFilters?: { categories?: PackageCategory[]; states?: PackageState[] }
  tooltip?: string
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
    group: "Packages",
    icon: <AllPackagesIcon />,
    id: "packages:all",
    label: "All",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [],
      states: [],
    },
  },
  {
    group: "Packages",
    icon: <DependenciesIcon />,
    id: `packages:${PackageCategory.DEPENDENCIES}`,
    label: "Dependencies",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.DEPENDENCIES],
      states: [],
    },
    tooltip: "Textures, props",
  },
  {
    group: "Packages",
    icon: <ModsIcon />,
    id: `packages:${PackageCategory.MODS}`,
    label: "Mods",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.MODS],
      states: [],
    },
    tooltip: "Gameplay mods, bugfixes, DLLs",
  },
  {
    group: "Packages",
    icon: <ResidentialIcon />,
    id: `packages:${PackageCategory.RESIDENTIAL}`,
    label: "Residential",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.RESIDENTIAL],
      states: [],
    },
    tooltip: "Residential lots",
  },
  {
    group: "Packages",
    icon: <CommercialIcon />,
    id: `packages:${PackageCategory.COMMERCIAL}`,
    label: "Commercial",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.COMMERCIAL],
      states: [],
    },
    tooltip: "Commercial lots",
  },
  {
    group: "Packages",
    icon: <IndustrialIcon />,
    id: `packages:${PackageCategory.INDUSTRIAL}`,
    label: "Industrial",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.INDUSTRIAL],
      states: [],
    },
    tooltip: "Industrial lots",
  },
  {
    group: "Packages",
    icon: <CivicsIcon />,
    id: `packages:${PackageCategory.CIVICS}`,
    label: "Civics",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.CIVICS],
      states: [],
    },
    tooltip: "Civic buildings, rewards",
  },
  {
    group: "Packages",
    icon: <LandmarksIcon />,
    id: `packages:${PackageCategory.LANDMARKS}`,
    label: "Landmarks",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.LANDMARKS],
      states: [],
    },
    tooltip: "Landmarks",
  },
  {
    group: "Packages",
    icon: <ParksIcon />,
    id: `packages:${PackageCategory.PARKS}`,
    label: "Parks",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.PARKS],
      states: [],
    },
    tooltip: "Parks",
  },
  {
    group: "Packages",
    icon: <EnergyIcon />,
    id: `packages:${PackageCategory.ENERGY}`,
    label: "Energy",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.ENERGY],
      states: [],
    },
    tooltip: "Energy infrastructure",
  },
  {
    group: "Packages",
    icon: <TransportIcon />,
    id: `packages:${PackageCategory.TRANSPORT}`,
    label: "Transport",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [PackageCategory.TRANSPORT],
      states: [],
    },
    tooltip: "Transportation infrastructure",
  },
  {
    group: "Packages",
    icon: <ProblemsIcon />,
    id: "packages:errors",
    label: "Problems",
    location: { page: Page.Packages, data: {} },
    packageFilters: {
      categories: [],
      states: [PackageState.ERROR],
    },
  },
]

export const defaultTab = tabs[0]
