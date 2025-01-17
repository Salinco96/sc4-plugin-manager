import type { Authors } from "./authors"
import type { Categories } from "./categories"
import type { Collections } from "./collections"
import type { ExemplarProperties } from "./exemplars"
import type { OptionInfo } from "./options"
import type { PackageID } from "./packages"
import type { ProfileID, ProfileInfo, Profiles } from "./profiles"
import type { Regions } from "./regions"
import type { Settings } from "./settings"
import type { Tools } from "./tools"
import type { Features, PackageInfo, Packages } from "./types"
import type { ContentsInfo } from "./variants"

export interface ApplicationState {
  authors: Authors
  categories: Categories
  collections?: Collections
  downloads: { [downloadKey in string]?: TaskInfo }
  exemplarProperties: ExemplarProperties
  externals: { [path: string]: ContentsInfo }
  features: Features
  linker: TaskInfo | null
  loader: TaskInfo | null
  maxis?: ContentsInfo
  packages?: Packages
  profiles?: Profiles
  profileOptions: OptionInfo[]
  regions?: Regions
  settings?: Settings
  simtropolis?: { displayName?: string; sessionId?: string; userId: string } | null
  templates?: Profiles
  tools?: Tools
}

export type Replace<T, R> = Omit<T, keyof R> & R

export type ApplicationStateUpdate = Replace<
  Partial<ApplicationState>,
  {
    downloads?: Record<string, TaskInfo | null | undefined>
    packages?: Record<PackageID, PackageInfo | null | undefined>
    profiles?: Record<ProfileID, ProfileInfo | null | undefined>
  }
>

export function getInitialState(): ApplicationState {
  return {
    authors: {},
    categories: {},
    downloads: {},
    exemplarProperties: {},
    externals: {},
    features: {},
    linker: null,
    loader: null,
    profileOptions: [],
  }
}

export interface TaskInfo {
  progress?: number
  step: string
}
