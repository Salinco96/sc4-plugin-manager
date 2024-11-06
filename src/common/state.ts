import { Authors } from "./authors"
import { Categories } from "./categories"
import { ExemplarPropertyInfo } from "./exemplars"
import { OptionInfo } from "./options"
import { PackageID } from "./packages"
import { ProfileID, ProfileInfo, Profiles } from "./profiles"
import { Settings } from "./settings"
import { Features, PackageInfo, Packages } from "./types"

export interface ApplicationConfig {
  categories: Categories
  exemplarProperties: Record<number, ExemplarPropertyInfo>
  profileOptions: OptionInfo[]
}

export interface ApplicationState {
  authors: Authors
  categories: Categories
  downloads: Record<string, TaskInfo>
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
