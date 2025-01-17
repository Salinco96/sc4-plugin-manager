import type { ID } from "@salinco/nice-utils"

export type RegionID = ID<string, RegionInfo>

export interface CityInfo {
  established: boolean
  name: string
}

export interface RegionInfo {
  cities: {
    [name in string]?: CityInfo
  }
  id: string
  name: string
}

export type Regions = {
  [id in RegionID]?: RegionInfo
}
