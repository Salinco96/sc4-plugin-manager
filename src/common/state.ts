import { PackageInfo, ProfileInfo, Settings } from "./types"

export interface ApplicationStatus {
  linker: string | null
  loader: string | null
  ongoingDownloads: string[]
  ongoingExtracts: string[]
}

export interface ApplicationState {
  packages?: { [packageId: string]: PackageInfo }
  profiles?: { [profileId: string]: ProfileInfo }
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
