import { RCIType, ZoneDensity } from "@common/lots"
import { DeveloperID, ZoneType } from "@node/dbpf/types"

export const ZoneTypeToRCIType: {
  [zoneType in ZoneType]?: RCIType
} = {
  [ZoneType.CommercialHigh]: RCIType.Commercial,
  [ZoneType.CommercialLow]: RCIType.Commercial,
  [ZoneType.CommercialMedium]: RCIType.Commercial,
  [ZoneType.IndustrialHigh]: RCIType.Industrial,
  [ZoneType.IndustrialLow]: RCIType.Agriculture,
  [ZoneType.IndustrialMedium]: RCIType.Industrial,
  [ZoneType.ResidentialHigh]: RCIType.Residential,
  [ZoneType.ResidentialLow]: RCIType.Residential,
  [ZoneType.ResidentialMedium]: RCIType.Residential,
}

export const RCITypeToZoneType: {
  [rciType in RCIType]: {
    [density in ZoneDensity]: ZoneType
  }
} = {
  [RCIType.Agriculture]: {
    [ZoneDensity.LOW]: ZoneType.IndustrialLow,
    [ZoneDensity.MEDIUM]: ZoneType.IndustrialLow,
    [ZoneDensity.HIGH]: ZoneType.IndustrialLow,
  },
  [RCIType.Commercial]: {
    [ZoneDensity.LOW]: ZoneType.CommercialLow,
    [ZoneDensity.MEDIUM]: ZoneType.CommercialMedium,
    [ZoneDensity.HIGH]: ZoneType.CommercialHigh,
  },
  [RCIType.Industrial]: {
    [ZoneDensity.LOW]: ZoneType.IndustrialMedium,
    [ZoneDensity.MEDIUM]: ZoneType.IndustrialMedium,
    [ZoneDensity.HIGH]: ZoneType.IndustrialHigh,
  },
  [RCIType.Residential]: {
    [ZoneDensity.LOW]: ZoneType.ResidentialLow,
    [ZoneDensity.MEDIUM]: ZoneType.ResidentialMedium,
    [ZoneDensity.HIGH]: ZoneType.ResidentialHigh,
  },
}

export const DeveloperIDToRCIType: {
  [developer in DeveloperID]: RCIType
} = {
  [DeveloperID.R$]: RCIType.Residential,
  [DeveloperID.R$$]: RCIType.Residential,
  [DeveloperID.R$$$]: RCIType.Residential,
  [DeveloperID.CS$]: RCIType.Commercial,
  [DeveloperID.CS$$]: RCIType.Commercial,
  [DeveloperID.CS$$$]: RCIType.Commercial,
  [DeveloperID.CO$$]: RCIType.Commercial,
  [DeveloperID.CO$$$]: RCIType.Commercial,
  [DeveloperID.IR]: RCIType.Agriculture,
  [DeveloperID.ID]: RCIType.Industrial,
  [DeveloperID.IM]: RCIType.Industrial,
  [DeveloperID.IHT]: RCIType.Industrial,
}
