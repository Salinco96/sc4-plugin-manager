import { PackageInfo, ProfileInfo, Settings } from "./types"

export interface ApplicationState {
  loadStatus: string | null
  ongoingDownloads: string[]
  packageGroups?: { [groupId: string]: string[] }
  packages?: { [packageId: string]: PackageInfo }
  profiles?: { [profileId: string]: ProfileInfo }
  settings?: Settings
}

export const initialState: ApplicationState = {
  loadStatus: null,
  ongoingDownloads: [],
}
