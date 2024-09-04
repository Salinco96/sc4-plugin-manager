import { Categories } from "./categories"
import { OptionInfo } from "./options"
import { Feature, PackageInfo, ProfileInfo, Settings } from "./types"

export interface ApplicationStatus {
  linker: string | null
  loader: string | null
  ongoingDownloads: TaskInfo[]
  ongoingExtracts: TaskInfo[]
}

export interface ApplicationState {
  categories?: Categories
  features?: Partial<Record<Feature, string[]>>
  globalOptions?: OptionInfo[]
  packages?: {
    [packageId: string]: PackageInfo | null
  }
  profiles?: {
    [profileId: string]: ProfileInfo | null
  }
  sessions: {
    simtropolis: {
      userId?: string | null
    }
  }
  settings?: Settings
  status: ApplicationStatus
  templates?: {
    [profileId: string]: ProfileInfo | null
  }
}

export const initialState: ApplicationState = {
  sessions: { simtropolis: {} },
  status: {
    linker: null,
    loader: null,
    ongoingDownloads: [],
    ongoingExtracts: [],
  },
}

export interface TaskInfo {
  readonly key: string
  readonly progress?: number
}
