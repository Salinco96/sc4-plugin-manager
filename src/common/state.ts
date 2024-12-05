import type { Authors } from "./authors"
import type { BuildingID, BuildingInfo } from "./buildings"
import type { Categories } from "./categories"
import type { ExemplarPropertyInfo } from "./exemplars"
import type { FamilyID, FamilyInfo } from "./families"
import type { LotID, LotInfo } from "./lots"
import type { FloraID, FloraInfo } from "./mmps"
import type { OptionInfo } from "./options"
import type { PackageID } from "./packages"
import type { ProfileID, ProfileInfo, Profiles } from "./profiles"
import type { PropID, PropInfo } from "./props"
import type { Settings } from "./settings"
import type { Features, PackageInfo, Packages } from "./types"

export interface Exemplars {
  buildingFamilies: {
    [familyId in FamilyID]?: FamilyInfo
  }
  buildings: {
    [instanceId in BuildingID]?: BuildingInfo
  }
  lots: {
    [instanceId in LotID]?: LotInfo
  }
  mmps: {
    [instanceId in FloraID]?: FloraInfo
  }
  propFamilies: {
    [familyId in FamilyID]?: FamilyInfo
  }
  props: {
    [instanceId in PropID]?: PropInfo
  }
}

export interface ApplicationState {
  authors: Authors
  categories: Categories
  downloads: {
    [downloadKey in string]?: TaskInfo
  }
  exemplarProperties: {
    [propertyId in number]?: ExemplarPropertyInfo
  }
  exemplars: Exemplars
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
    exemplars: {
      buildingFamilies: {},
      buildings: {},
      lots: {},
      mmps: {},
      propFamilies: {},
      props: {},
    },
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
