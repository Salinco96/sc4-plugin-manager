import type { BuildingID, BuildingInfo } from "./buildings"
import type { GroupID, InstanceID } from "./dbpf"
import type { FamilyID, FamilyInfo } from "./families"
import type { LotID, LotInfo } from "./lots"
import type { FloraID, FloraInfo } from "./mmps"
import type { PackageID } from "./packages"
import type { PropID, PropInfo } from "./props"
import type { ModelID, TextureID } from "./variants"

export const MAXIS_FILES = [
  "SimCity_1.dat",
  "SimCity_2.dat",
  "SimCity_3.dat",
  "SimCity_4.dat",
  "SimCity_5.dat",
]

export type FileContentsInfo = {
  buildingFamilies?: FamilyInfo[]
  buildings?: BuildingInfo[]
  lots?: LotInfo[]
  mmps?: FloraInfo[]
  models?: ModelID[]
  propFamilies?: FamilyInfo[]
  props?: PropInfo[]
  textures?: TextureID[]
}

export type FileContents = {
  [path in string]?: FileContentsInfo
}

export type PluginsFileInfo = FileContentsInfo & {
  logs?: string
  issues?: {
    conflictingPackages?: PackageID[]
    dllNotTopLevel?: boolean
    unsupported?: boolean
  }
}

export type Plugins = {
  [path in string]?: PluginsFileInfo
}

export type Index = {
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
