import type { AuthorID, AuthorInfo } from "@common/authors"
import type { CategoryID } from "@common/categories"
import type { CollectionID, CollectionInfo } from "@common/collections"
import type { PackageID } from "@common/packages"
import type { ProfileID, ProfileInfo } from "@common/profiles"
import type { CityID, CityInfo, RegionID, RegionInfo } from "@common/regions"
import type { DatabaseSettings } from "@common/settings"
import { type ApplicationState, getInitialState } from "@common/state"
import type { ToolID, ToolInfo } from "@common/tools"
import type { PackageInfo, PackageStatus, VariantState } from "@common/types"
import type { VariantID, VariantInfo } from "@common/variants"
import { required } from "@salinco/nice-utils"
import { createStore } from "./utils"

export interface PackageUi {
  variantId: VariantID
  variantIds: VariantID[]
}

export interface PackageFilters {
  authors: AuthorID[]
  categories: CategoryID[]
  combine: "and" | "or"
  dependencies: boolean
  experimental: boolean
  incompatible: boolean
  onlyErrors: boolean
  onlyNew: boolean
  onlyUpdates: boolean
  search: string
  state: VariantState | null
  states: VariantState[]
}

export interface MainState extends ApplicationState {
  packageFilters: PackageFilters
  filteredPackages: PackageID[]
  packageUi: {
    [packageId in PackageID]?: PackageUi
  }
}

const initialState: MainState = {
  ...getInitialState(),
  filteredPackages: [],
  packageFilters: {
    authors: [],
    categories: [],
    combine: "or",
    dependencies: true,
    experimental: true,
    incompatible: true,
    onlyErrors: false,
    onlyNew: false,
    onlyUpdates: false,
    search: "",
    state: null,
    states: [],
  },
  packageUi: {},
}

function getAuthorInfo(state: MainState, authorId: AuthorID): AuthorInfo {
  return required(state.authors?.[authorId], `Unknown author ${authorId}`)
}

export function getCityInfo(state: MainState, regionId: RegionID, cityId: CityID): CityInfo {
  const regionInfo = getRegionInfo(state, regionId)
  return required(regionInfo.cities[cityId], `Unknown city ${regionId}/${cityId}`)
}

export function getCollectionInfo(state: MainState, collectionId: CollectionID): CollectionInfo {
  return required(state.collections?.[collectionId], `Unknown collection ${collectionId}`)
}

export function getCurrentProfile(state: MainState): ProfileInfo | undefined {
  const profileId = state.settings?.currentProfile
  return profileId ? state.profiles?.[profileId] : undefined
}

export function getCurrentVariant(state: MainState, packageId: PackageID): VariantInfo {
  return getVariantInfo(state, packageId)
}

function getDatabaseSettings(state: MainState): DatabaseSettings | undefined {
  return state.settings?.db
}

function getFilteredVariants(state: MainState, packageId: PackageID): VariantID[] {
  return required(state.packageUi[packageId], `Unknown package ${packageId}`).variantIds
}

export function getPackageInfo(state: MainState, packageId: PackageID): PackageInfo {
  return required(state.packages?.[packageId], `Unknown package ${packageId}`)
}

function getPackageStatus(
  state: MainState,
  packageId: PackageID,
  profileId: ProfileID | undefined = getCurrentProfile(state)?.id,
): PackageStatus | undefined {
  return profileId ? getPackageInfo(state, packageId).status[profileId] : undefined
}

export function getPackageName(state: MainState, packageId: PackageID): string {
  return state.packages?.[packageId]?.name ?? packageId
}

function getProfileInfo(state: MainState, profileId: ProfileID): ProfileInfo {
  return required(state.profiles?.[profileId], `Unknown profile ${profileId}`)
}

export function getRegionInfo(state: MainState, regionId: RegionID): RegionInfo {
  return required(state.regions?.[regionId], `Unknown region ${regionId}`)
}

function getToolInfo(state: MainState, toolId: ToolID): ToolInfo {
  return required(state.tools?.[toolId], `Unknown tool ${toolId}`)
}

function getVariantInfo(
  state: MainState,
  packageId: PackageID,
  variantId: VariantID = required(state.packageUi[packageId]).variantId,
): VariantInfo {
  const packageInfo = getPackageInfo(state, packageId)
  return required(packageInfo.variants[variantId], `Unknown variant ${packageId}#${variantId}`)
}

export const store = createStore("main", initialState, {
  getAuthorInfo,
  getCityInfo,
  getCollectionInfo,
  getCurrentProfile,
  getCurrentVariant,
  getDatabaseSettings,
  getFilteredVariants,
  getPackageInfo,
  getPackageName,
  getPackageStatus,
  getProfileInfo,
  getRegionInfo,
  getToolInfo,
  getVariantInfo,
})
