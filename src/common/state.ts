import { PackageInfo, ProfileInfo, Settings } from "./types"

export interface ApplicationState {
  conflictGroups?: { [groupId: string]: string[] }
  linking: boolean
  loadStatus: string | null
  ongoingDownloads: string[]
  ongoingExtracts: string[]
  packages?: { [packageId: string]: PackageInfo }
  profiles?: { [profileId: string]: ProfileInfo }
  settings?: Settings
}

export const initialState: ApplicationState = {
  linking: false,
  loadStatus: null,
  ongoingDownloads: [],
  ongoingExtracts: [],
}
