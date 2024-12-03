import type { ID } from "@salinco/nice-utils"
import type { Namespace, TFunction } from "i18next"

import type { AssetData, AssetID } from "./assets"
import type { AuthorID } from "./authors"
import type { BuildingData, BuildingInfo } from "./buildings"
import type { CategoryID } from "./categories"
import type { TGI } from "./dbpf"
import type { ExemplarDataPatch } from "./exemplars"
import type { LotData, LotInfo } from "./lots"
import type { OptionData, OptionID, OptionInfo, OptionValue, Requirements } from "./options"
import type { PackageID } from "./packages"
import type { FamilyData, FamilyInfo, PropData, PropInfo } from "./props"
import type { Feature, MMPData, MMPInfo, PackageWarning, VariantState } from "./types"
import type { MaybeArray } from "./utils/types"

/** Variant ID */
export type VariantID = ID<string, VariantInfo>

export interface ContentsData {
  buildingFamilies?: {
    [path in string]?: {
      [familyId in string]?: FamilyData
    }
  }
  buildings?: {
    [path in string]?: {
      [instanceId in string]?: BuildingData
    }
  }
  lots?: {
    [path in string]?: {
      [instanceId in string]?: LotData
    }
  }
  models?: {
    [path in string]?: string[]
  }
  propFamilies?: {
    [path in string]?: {
      [familyId in string]?: FamilyData
    }
  }
  props?: {
    [path in string]?: {
      [instanceId in string]?: PropData
    }
  }
  textures?: {
    [path in string]?: string[]
  }
}

export interface ContentsInfo {
  buildingFamilies?: {
    [path in string]?: {
      [familyId in string]?: FamilyInfo
    }
  }
  buildings?: {
    [path in string]?: {
      [instanceId in string]?: BuildingInfo
    }
  }
  lots?: {
    [path in string]?: {
      [instanceId in string]?: LotInfo
    }
  }
  models?: {
    [path in string]?: string[]
  }
  propFamilies?: {
    [path in string]?: {
      [familyId in string]?: FamilyInfo
    }
  }
  props?: {
    [path in string]?: {
      [instanceId in string]?: PropInfo
    }
  }
  textures?: {
    [path in string]?: string[]
  }
}

export interface ContentsInfo {
  buildingFamilies?: {
    [path in string]?: {
      [familyId in string]?: FamilyInfo
    }
  }
  buildings?: {
    [path in string]?: {
      [instanceId in string]?: BuildingInfo
    }
  }
  lots?: {
    [path in string]?: {
      [instanceId in string]?: LotInfo
    }
  }
  models?: {
    [path in string]?: string[]
  }
  propFamilies?: {
    [path in string]?: {
      [familyId in string]?: FamilyInfo
    }
  }
  props?: {
    [path in string]?: {
      [instanceId in string]?: PropInfo
    }
  }
  textures?: {
    [path in string]?: string[]
  }
}

export interface FileData {
  as?: string
  condition?: Requirements
  patches?: {
    [entryId in TGI]?: ExemplarDataPatch
  }
  path: string
  priority?: number
}

export interface FileInfo extends FileData {}

export interface VariantData extends ContentsData {
  assets?: Array<AssetID | VariantAssetData>
  authors?: MaybeArray<AuthorID>
  category?: MaybeArray<string>
  credits?: { [authorId in AuthorID]?: string | null }
  dependencies?: Array<PackageID | DependencyInfo>
  deprecated?: boolean | PackageID
  description?: string
  disabled?: boolean
  experimental?: boolean
  files?: FileData[]
  images?: string[]
  lastGenerated?: Date
  lastModified?: Date
  logs?: string
  mmps?: MMPData[]
  name?: string
  optional?: PackageID[]
  options?: OptionData[]
  readme?: string
  release?: Date
  repository?: string
  requirements?: Requirements
  summary?: string
  support?: string
  thanks?: { [authorId in AuthorID]?: string | null }
  thumbnail?: string
  url?: string
  version?: string
  warnings?: PackageWarning[]
}

export interface BaseVariantInfo extends ContentsInfo {
  assets?: VariantAssetInfo[]
  authors: AuthorID[]
  categories: CategoryID[]
  credits: { [authorId in AuthorID]?: string | null }
  dependencies?: DependencyInfo[]
  deprecated?: boolean | PackageID
  description?: string
  disabled?: boolean
  experimental?: boolean
  files?: FileInfo[]
  id: VariantID
  images?: string[]
  lastModified?: string
  logs?: string
  mmps?: MMPInfo[]
  name: string
  new?: boolean
  optional?: PackageID[]
  options?: OptionInfo[]
  priority: number
  readme?: string
  release?: string
  repository?: string
  requirements?: Requirements
  summary?: string
  support?: string
  thanks?: { [authorId in AuthorID]?: string | null }
  thumbnail?: string
  url?: string
  version: string
  warnings?: PackageWarning[]
}

export interface VariantInfo extends BaseVariantInfo {
  action?: "installing" | "updating" | "removing"
  docs?: string
  installed?: boolean
  local?: boolean
  update?: BaseVariantInfo
}

export enum Issue {
  CONFLICTING_FEATURE = "conflicting-feature",
  INCOMPATIBLE_DEPENDENCIES = "incompatible-dependencies",
  INCOMPATIBLE_FEATURE = "incompatible-feature",
  INCOMPATIBLE_OPTION = "incompatible-option",
  INCOMPATIBLE_VERSION = "incompatible-version",
  MISSING_FEATURE = "missing-feature",
}

export interface VariantIssue {
  external?: boolean
  feature?: Feature
  option?: OptionID
  id: Issue
  minVersion?: string
  packages?: PackageID[]
  value?: OptionValue
}

export interface VariantAssetData extends AssetData {
  cleanitol?: string[]
  docs?: Array<string | FileInfo>
  exclude?: string[]
  include?: Array<string | FileInfo>
  id: AssetID
}

export interface VariantAssetInfo extends VariantAssetData {
  docs?: FileInfo[]
  include?: FileInfo[]
}

export interface DependencyData {
  id: PackageID
  include?: string[]
  transitive?: boolean
}

export interface DependencyInfo extends DependencyData {
  transitive: boolean
}

export function getStateLabel(
  t: TFunction<Namespace>,
  state: VariantState | "default" | "selected",
): string {
  return t(state, { ns: "VariantState" })
}
