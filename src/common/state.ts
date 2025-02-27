import type { Spec } from "immutability-helper"

import type { Authors } from "./authors"
import type { Categories } from "./categories"
import type { Collections } from "./collections"
import type { ExemplarProperties } from "./exemplars"
import type { OptionInfo } from "./options"
import type { Index, Plugins } from "./plugins"
import type { Profiles } from "./profiles"
import type { Regions } from "./regions"
import type { Settings } from "./settings"
import type { Tools } from "./tools"
import type { Features, Packages } from "./types"

export interface ApplicationState {
  authors: Authors
  categories: Categories
  collections: Collections | undefined
  exemplarProperties: ExemplarProperties
  features: Features
  index: Index | undefined
  packages: Packages | undefined
  plugins: Plugins | undefined
  profiles: Profiles | undefined
  profileOptions: OptionInfo[]
  regions: Regions | undefined
  settings: Settings | undefined
  simtropolis: { displayName?: string; sessionId?: string; userId: string } | null | undefined
  templates: Profiles | undefined
  tools: Tools | undefined
}

export interface ApplicationStatus {
  tasks: TaskInfo[]
}

export type ApplicationStateUpdate = {
  data: { [K in keyof ApplicationState]?: Spec<ApplicationState[K]> } | { $merge: ApplicationState }
  recompute: boolean
}

export function getInitialState(): ApplicationState {
  return {
    authors: {},
    categories: {},
    collections: undefined,
    exemplarProperties: {},
    features: {},
    index: undefined,
    packages: undefined,
    plugins: {},
    profiles: undefined,
    profileOptions: [],
    regions: undefined,
    settings: undefined,
    simtropolis: undefined,
    templates: undefined,
    tools: undefined,
  }
}

export interface TaskInfo {
  key: string
  label?: string
  progress?: number
}
