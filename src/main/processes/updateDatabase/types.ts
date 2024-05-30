export interface UpdateDatabaseProcessData {
  branch: string
  origin: string
}

export interface UpdateDatabaseProcessResponse {
  error?: Error
  success: boolean
}
