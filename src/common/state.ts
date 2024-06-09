import { PackageInfo, ProfileInfo, Settings } from "./types"

export interface ApplicationStatus {
  linker: string | null
  loader: string | null
  ongoingDownloads: TaskInfo[]
  ongoingExtracts: TaskInfo[]
}

export interface ApplicationState {
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
