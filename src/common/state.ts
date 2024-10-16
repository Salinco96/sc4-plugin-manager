import { Authors } from "./authors"
import { Categories } from "./categories"
import { OptionInfo } from "./options"
import { PackageID } from "./packages"
import { ProfileID, ProfileInfo, Profiles } from "./profiles"
import { Settings } from "./settings"
import { Features, PackageInfo, Packages } from "./types"

export interface ApplicationStatus {
  linker: string | null
  loader: string | null
  ongoingDownloads: TaskInfo[]
  ongoingExtracts: TaskInfo[]
}

export interface ApplicationState {
  authors: Authors
  categories: Categories
  features: Features
  options: OptionInfo[]
  packages: Packages | undefined
  profiles: Profiles | undefined
  settings: Settings | undefined
  simtropolis: { userId: string } | null | undefined
  status: ApplicationStatus
  templates: Profiles | undefined
}

export interface ApplicationStateUpdate
  extends Omit<Partial<ApplicationState>, "packages" | "profiles"> {
  packages?: {
    [packageId in PackageID]?: PackageInfo | null
  }
  profiles?: {
    [profileId in ProfileID]?: ProfileInfo | null
  }
}

export function getInitialState(): ApplicationState {
  return {
    authors: {},
    categories: {},
    features: {},
    options: [],
    packages: undefined,
    profiles: undefined,
    settings: undefined,
    simtropolis: undefined,
    status: {
      linker: null,
      loader: null,
      ongoingDownloads: [],
      ongoingExtracts: [],
    },
    templates: undefined,
  }
}

export interface TaskInfo {
  readonly key: string
  readonly progress?: number
}
