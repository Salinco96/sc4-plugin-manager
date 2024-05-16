export interface ApplicationState {
  ongoingDownloads: string[]
}

export const initialState: ApplicationState = {
  ongoingDownloads: [],
}
