import type { Authors } from "./authors"
import type { Categories } from "./categories"
import type { ExemplarPropertyInfo } from "./exemplars"
import type { OptionInfo } from "./options"
import type { PackageID } from "./packages"
import type { ProfileID, ProfileInfo, Profiles } from "./profiles"
import type { Settings } from "./settings"
import type { Features, PackageInfo, Packages } from "./types"

export interface ApplicationState {
  authors: Authors
  categories: Categories
  downloads: Record<string, TaskInfo>
  exemplarProperties: Record<number, ExemplarPropertyInfo>
  features: Features
  linker: TaskInfo | null
  loader: TaskInfo | null
  packages: Packages | undefined
  profiles: Profiles | undefined
  profileOptions: OptionInfo[]
  settings: Settings | undefined
  simtropolis: { userId: string } | null | undefined
  templates: Profiles | undefined
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
    features: {},
    linker: null,
    loader: null,
    packages: undefined,
    profiles: undefined,
    profileOptions: [],
    settings: undefined,
    simtropolis: undefined,
    templates: undefined,
  }
}

export interface TaskInfo {
  progress?: number
  step: string
}
