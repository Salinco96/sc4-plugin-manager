import type { Authors } from "./authors"
import type { BuildingID, BuildingInfo } from "./buildings"
import type { Categories } from "./categories"
import type { Collections } from "./collections"
import type { GroupID, InstanceID } from "./dbpf"
import type { ExemplarProperties } from "./exemplars"
import type { FamilyID, FamilyInfo } from "./families"
import type { LotID, LotInfo } from "./lots"
import type { FloraID, FloraInfo } from "./mmps"
import type { OptionInfo } from "./options"
import type { PackageID } from "./packages"
import type { ProfileID, ProfileInfo, Profiles } from "./profiles"
import type { PropID, PropInfo } from "./props"
import type { Regions } from "./regions"
import type { Settings } from "./settings"
import type { Tools } from "./tools"
import type { Features, PackageInfo, Packages } from "./types"
import type { Contents, TextureID } from "./variants"

export interface Index {
  buildingFamilies: {
    [familyId in FamilyID]?: {
      buildings: BuildingInfo[]
      family?: FamilyInfo
    }
  }
  buildings: {
    [buildingId in BuildingID]?: BuildingInfo[]
  }
  lots: {
    [lotId in LotID]?: LotInfo[]
  }
  mmps: {
    [mmpId in FloraID]?: FloraInfo[]
  }
  models: {
    [groupId in GroupID]?: {
      [instanceId in InstanceID]?: string[]
    }
  }
  propFamilies: {
    [familyId in FamilyID]?: {
      family?: FamilyInfo
      props: PropInfo[]
    }
  }
  props: {
    [propId in PropID]?: PropInfo[]
  }
  textures: {
    [textureId in TextureID]?: string[]
  }
}

export interface ApplicationState {
  authors: Authors
  categories: Categories
  collections: Collections | undefined
  exemplarProperties: ExemplarProperties
  features: Features
  index: Index | undefined
  packages: Packages | undefined
  plugins: Contents | undefined
  profiles: Profiles | undefined
  profileOptions: OptionInfo[]
  regions: Regions | undefined
  settings: Settings | undefined
  simtropolis: { displayName?: string; sessionId?: string; userId: string } | null | undefined
  templates: Profiles | undefined
  tools: Tools | undefined
}

export interface ApplicationStatus {
  downloads: { [downloadKey in string]?: TaskInfo }
  linker: TaskInfo | null
  loader: TaskInfo | null
}

export type Replace<T, R> = Omit<T, keyof R> & R

export type ApplicationStateUpdate = Replace<
  Partial<ApplicationState>,
  {
    packages?: Record<PackageID, PackageInfo | null | undefined>
    profiles?: Record<ProfileID, ProfileInfo | null | undefined>
  }
>

export type ApplicationStatusUpdate = Replace<
  Partial<ApplicationStatus>,
  {
    downloads?: Record<string, TaskInfo | null | undefined>
  }
>

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
  progress?: number
  step: string
}
