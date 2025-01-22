import { type ID, keys, size } from "@salinco/nice-utils"
import type { RCIType, ZoneDensity } from "./lots"
import type { ProfileID, Profiles } from "./profiles"
import type { Settings } from "./settings"

export type CityID = ID<string, CityInfo>

export type RegionID = ID<string, RegionInfo>

export interface CityInfo {
  backups: CityBackupInfo[]
  established: boolean
  id: CityID
  name: string
  version: number
}

export interface CityBackupInfo {
  description?: string
  file: string
  time: Date
  version: number
}

export type Action<K extends string, P extends Record<string, true | Record<string, unknown>>> = {
  [A in keyof P]: { [N in K]: A } & P[A]
}[keyof P]

export type UpdateSaveAction = Action<
  "action",
  {
    growify: {
      backup: boolean
      density: ZoneDensity
      historical: boolean
      rciTypes: RCIType[]
    }
    historical: {
      backup: boolean
      rciTypes: RCIType[]
    }
  }
>

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

export function hasBackup(city: CityInfo): boolean {
  return city.backups.some(backup => backup.version === city.version)
}

export function getRegionLinkedProfileId(
  regionId: RegionID,
  settings: Settings | undefined,
  profiles: Profiles | undefined,
): ProfileID | undefined {
  const regionSettings = settings?.regions?.[regionId]
  if (regionSettings?.profile) {
    if (!profiles || profiles[regionSettings.profile]) {
      return regionSettings.profile
    }
  }

  if (profiles && size(profiles) === 1) {
    return keys(profiles)[0]
  }
}

export function getCityLinkedProfileId(
  regionId: RegionID,
  cityId: CityID,
  settings: Settings | undefined,
): ProfileID | undefined {
  return settings?.regions?.[regionId]?.cities?.[cityId]?.profile
}
