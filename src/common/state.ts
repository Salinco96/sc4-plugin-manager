import { AssetInfo, PackageInfo, ProfileInfo, Settings } from "./types"

export interface ApplicationData {
  localPackages: { [packageId: string]: PackageInfo }
  profiles: { [profileId: string]: ProfileInfo }
  remoteAssets: { [assetId: string]: AssetInfo }
  remotePackages: { [packageId: string]: PackageInfo }
  settings: Settings
}

export interface ApplicationState {
  data: Partial<ApplicationData>
  loadStatus: string | null
  ongoingDownloads: string[]
}

export const initialState: ApplicationState = {
  data: {},
  loadStatus: null,
  ongoingDownloads: [],
}
