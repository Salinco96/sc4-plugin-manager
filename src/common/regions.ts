import type { ID } from "@salinco/nice-utils"

export type CityID = ID<string, CityInfo>

export type RegionID = ID<string, RegionInfo>

export interface CityInfo {
  backups: CityBackupInfo[]
  established: boolean
  id: CityID
  name: string
}

export interface CityBackupInfo {
  current: boolean
  description?: string
  file: string
  time: Date
  version: number
}

export type Cities = {
  [id in CityID]?: CityInfo
}

export interface RegionInfo {
  cities: Cities
  id: RegionID
  name: string
}

export type Regions = {
  [id in RegionID]?: RegionInfo
}

export function getCityFileName(cityId: CityID): string {
  return `City - ${cityId}.sc4`
}
