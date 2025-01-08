import {
  containsAny,
  filterValues,
  generate,
  isEmpty,
  isNumber,
  sum,
  toHex,
  unique,
  values,
} from "@salinco/nice-utils"

import { CategoryID } from "@common/categories"
import { TGI, parseTGI } from "@common/dbpf"
import { ExemplarPropertyID } from "@common/exemplars"
import { Menu, type MenuID, Submenu } from "@common/submenus"

import type { BuildingID, BuildingInfo } from "@common/buildings"
import type { FamilyID } from "@common/families"
import {
  BudgetItemDepartment,
  DemandID,
  DeveloperID,
  type Exemplar,
  OccupantGroup,
  PowerPlantType,
  QueryExemplarGUID,
} from "./types"
import { get, getArray, getBool, getMap, getModelId, getString, getTGI } from "./utils"

export function getBuildingInfo(exemplar: Exemplar): BuildingInfo {
  const data: BuildingInfo = {
    file: exemplar.file,
    id: toHex(parseTGI(exemplar.id)[2], 8) as BuildingID,
  }

  const ogs = getArray(exemplar, ExemplarPropertyID.OccupantGroups) ?? []

  data.categories = getCategories(exemplar)
  data.menu = getDefaultMenu(ogs)
  data.submenus = getSubmenus(exemplar)

  const plopCost = get(exemplar, ExemplarPropertyID.PlopCost)
  if (plopCost) {
    data.cost = plopCost
  }

  const maintenanceCost = sum(getArray(exemplar, ExemplarPropertyID.BudgetItemCost) ?? [])
  if (maintenanceCost) {
    data.maintenance = maintenanceCost
  }

  const bulldozeCost = get(exemplar, ExemplarPropertyID.BulldozeCost)
  if (bulldozeCost) {
    data.bulldoze = bulldozeCost
  }

  const name = getString(exemplar, ExemplarPropertyID.ExemplarName)
  if (name?.length) {
    data.name = name
  }

  const label = getString(exemplar, ExemplarPropertyID.ItemLabel)
  if (label?.length) {
    data.label = label
  }

  const description = getString(exemplar, ExemplarPropertyID.ItemDescription)
  if (description?.length) {
    data.description = description
  }

  const familyIds = getArray(exemplar, ExemplarPropertyID.PropFamily)
  if (familyIds?.length) {
    data.families = familyIds.map(familyId => toHex(familyId, 8) as FamilyID)
  }

  const worth = get(exemplar, ExemplarPropertyID.BuildingValue)
  if (worth) {
    data.worth = worth
  }

  const flamability = get(exemplar, ExemplarPropertyID.Flamability)
  if (flamability) {
    data.flamability = flamability
  }

  const powerConsumed = get(exemplar, ExemplarPropertyID.PowerConsumed)
  if (powerConsumed) {
    data.power = powerConsumed
  }

  const powerGenerated = get(exemplar, ExemplarPropertyID.PowerGenerated)
  if (powerGenerated) {
    data.powerProduction = powerGenerated
  }

  const waterConsumed = get(exemplar, ExemplarPropertyID.WaterConsumed)
  if (waterConsumed) {
    data.water = waterConsumed
  }

  const waterProduced = get(exemplar, ExemplarPropertyID.WaterProduced)
  if (waterProduced) {
    data.waterProduction = waterProduced
  }

  const airPollution = get(exemplar, ExemplarPropertyID.PollutionAtCenter, 0)
  if (airPollution) {
    data.pollution = airPollution

    const radius = get(exemplar, ExemplarPropertyID.PollutionRadius, 0)
    if (radius) {
      data.pollutionRadius = radius
    }
  }

  const waterPollution = get(exemplar, ExemplarPropertyID.PollutionAtCenter, 1)
  if (waterPollution) {
    data.waterPollution = waterPollution

    const radius = get(exemplar, ExemplarPropertyID.PollutionRadius, 1)
    if (radius) {
      data.waterPollutionRadius = radius
    }
  }

  const garbage = get(exemplar, ExemplarPropertyID.PollutionAtCenter, 2)
  if (garbage) {
    data.garbage = garbage

    const radius = get(exemplar, ExemplarPropertyID.PollutionRadius, 2)
    if (radius) {
      data.garbageRadius = radius
    }
  }

  const radiation = get(exemplar, ExemplarPropertyID.PollutionAtCenter, 3)
  if (radiation) {
    data.radiation = radiation

    const radius = get(exemplar, ExemplarPropertyID.PollutionRadius, 3)
    if (radius) {
      data.radiationRadius = radius
    }
  }

  const landmarkEffect = get(exemplar, ExemplarPropertyID.LandmarkEffect, 0)
  if (landmarkEffect) {
    data.landmark = landmarkEffect

    const radius = get(exemplar, ExemplarPropertyID.LandmarkEffect, 1)
    if (radius) {
      data.landmarkRadius = radius
    }
  }

  const mayorRatingEffect = get(exemplar, ExemplarPropertyID.MayorRatingEffect, 0)
  if (mayorRatingEffect) {
    data.rating = mayorRatingEffect

    const radius = get(exemplar, ExemplarPropertyID.MayorRatingEffect, 1)
    if (radius) {
      data.ratingRadius = radius
    }
  }

  // TODO: Other possibilities?
  const model =
    getTGI(exemplar, ExemplarPropertyID.ResourceKeyType0) ??
    getTGI(exemplar, ExemplarPropertyID.ResourceKeyType1)
  if (model) {
    data.model = model === TGI(0, 0, 0) ? null : getModelId(model)
  }

  const capacitySatisfied = getMap<DeveloperID>(exemplar, ExemplarPropertyID.CapacitySatisfied)
  if (capacitySatisfied) {
    const capacity = filterValues(
      {
        r$: capacitySatisfied[DeveloperID.R$],
        r$$: capacitySatisfied[DeveloperID.R$$],
        r$$$: capacitySatisfied[DeveloperID.R$$$],
        cs$: capacitySatisfied[DeveloperID.CS$],
        cs$$: capacitySatisfied[DeveloperID.CS$$],
        cs$$$: capacitySatisfied[DeveloperID.CS$$$],
        co$$: capacitySatisfied[DeveloperID.CO$$],
        co$$$: capacitySatisfied[DeveloperID.CO$$$],
        ir: capacitySatisfied[DeveloperID.IR],
        id: capacitySatisfied[DeveloperID.ID],
        im: capacitySatisfied[DeveloperID.IM],
        iht: capacitySatisfied[DeveloperID.IHT],
      },
      Boolean,
    )

    if (!isEmpty(capacity)) {
      data.capacity = capacity
    }
  }

  const demandCreated = getMap<DemandID>(exemplar, ExemplarPropertyID.DemandCreated)
  if (demandCreated) {
    const jobs = filterValues(
      {
        $: demandCreated[DemandID.Jobs$],
        $$: demandCreated[DemandID.Jobs$$],
        $$$: demandCreated[DemandID.Jobs$$$],
      },
      Boolean,
    )

    if (!isEmpty(jobs)) {
      data.jobs = jobs
    }
  }

  const demandSatisfied = getMap<DemandID>(exemplar, ExemplarPropertyID.DemandSatisfied)
  if (demandSatisfied) {
    const relief = filterValues(
      {
        r$: demandSatisfied[DemandID.R$],
        r$$: demandSatisfied[DemandID.R$$],
        r$$$: demandSatisfied[DemandID.R$$$],
        co$$: demandSatisfied[DemandID.CO$$],
        co$$$: demandSatisfied[DemandID.CO$$$],
        ir: demandSatisfied[DemandID.IR],
        id: demandSatisfied[DemandID.ID],
        im: demandSatisfied[DemandID.IM],
        iht: demandSatisfied[DemandID.IHT],
      },
      Boolean,
    )

    if (!isEmpty(relief)) {
      data.relief = relief
    }
  }

  return data
}

const menuOgs: {
  [menu in Menu]?: OccupantGroup[]
} = {
  [Menu.Airports]: [OccupantGroup.Airport],
  [Menu.Education]: [
    OccupantGroup.School,
    OccupantGroup.College,
    OccupantGroup.Library,
    OccupantGroup.Museum,
  ],
  [Menu.Fire]: [OccupantGroup.Fire],
  [Menu.Garbage]: [OccupantGroup.Garbage],
  [Menu.Health]: [OccupantGroup.Health],
  [Menu.Landmarks]: [OccupantGroup.Landmark],
  [Menu.MiscTransit]: [OccupantGroup.MiscTransit],
  [Menu.Parks]: [OccupantGroup.Park],
  [Menu.Police]: [OccupantGroup.Police, OccupantGroup.Jail],
  [Menu.Power]: [OccupantGroup.Power],
  [Menu.Rail]: [OccupantGroup.Rail],
  [Menu.Rewards]: [OccupantGroup.Reward],
  [Menu.Water]: [OccupantGroup.Water],
  [Menu.WaterTransit]: [OccupantGroup.WaterTransit],
}

function getDefaultMenu(ogs: number[]): Menu | undefined {
  return values(Menu)
    .filter(menu => isNumber(menu))
    .find(menu => menuOgs[menu] && containsAny(ogs, menuOgs[menu]))
}

function getCategories(exemplar: Exemplar): CategoryID[] {
  const categories: CategoryID[] = []

  const groups = getArray(exemplar, ExemplarPropertyID.OccupantGroups) ?? []

  // Mapping for more readability afterwards
  const og = generate(
    values(OccupantGroup).filter(group => isNumber(group)),
    group => [`is${OccupantGroup[group] as keyof typeof OccupantGroup}`, groups.includes(group)],
  )

  if (og.isAirport) {
    categories.push(CategoryID.AIRPORTS)
  }

  if (og.isSeaport) {
    categories.push(CategoryID.SEAPORTS)
  } else if (og.isPassengerFerry || og.isCarFerry) {
    categories.push(CategoryID.FERRY)
  } else if (og.isBteInlandWaterway || og.isSgWaterway) {
    categories.push(CategoryID.CANALS)
  } else if (og.isBteWaterfront) {
    categories.push(CategoryID.WATERFRONT)
  }

  if (og.isMarina) {
    categories.push(CategoryID.MARINA)
  }

  if (og.isLightRail) {
    categories.push(CategoryID.TRAM)
  }

  if (og.isFreightRail) {
    categories.push(CategoryID.FREIGHT)
  }

  if (og.isPassengerRail) {
    categories.push(CategoryID.PASSENGERS)
  }

  if (og.isMonorail) {
    categories.push(CategoryID.MONORAIL)
  }

  if (og.isRail && !og.isLightRail && !og.isFreightRail && !og.isPassengerRail && !og.isMonorail) {
    categories.push(CategoryID.RAIL)
    categories.push(CategoryID.FILLERS)
  }

  if (og.isBus) {
    categories.push(CategoryID.BUS)
  }

  if (og.isSubway) {
    categories.push(CategoryID.SUBWAY)
  }

  if (og.isMiscTransit && !og.isBus && !og.isLightRail && !og.isSubway) {
    categories.push(CategoryID.TRANSPORT)
  }

  if (og.isSchool || og.isCollege || og.isLibrary || og.isMuseum) {
    categories.push(CategoryID.EDUCATION)
  }

  if (og.isHealth) {
    categories.push(CategoryID.HEALTH)
  }

  if (og.isLandmark) {
    categories.push(CategoryID.LANDMARKS)
  }

  if (og.isPolice || og.isJail) {
    categories.push(CategoryID.POLICE)
  }

  if (og.isPower) {
    categories.push(CategoryID.POWER)
  }

  if (og.isWater) {
    categories.push(CategoryID.WASTE)
  }

  if (og.isLandfill) {
    categories.push(CategoryID.WASTE)
  }

  if (og.isWorship || og.isCemetery || og.isBteReligious) {
    categories.push(CategoryID.RELIGION)
  }

  if (og.isReward) {
    categories.push(CategoryID.REWARDS)
  }

  if (og.isR$) {
    categories.push(CategoryID.R$)
  }

  if (og.isR$$) {
    categories.push(CategoryID.R$$)
  }

  if (og.isR$$$) {
    categories.push(CategoryID.R$$$)
  }

  if (og.isCS$) {
    categories.push(CategoryID.CS$)
  }

  if (og.isCS$$) {
    categories.push(CategoryID.CS$$)
  }

  if (og.isCS$$$) {
    categories.push(CategoryID.CS$$$)
  }

  if (og.isCO$$) {
    categories.push(CategoryID.CO$$)
  }

  if (og.isCO$$$) {
    categories.push(CategoryID.CO$$$)
  }

  if (og.isAgriculture) {
    categories.push(CategoryID.AGRICULTURE)
  }

  if (og.isIndustrialDirty) {
    categories.push(CategoryID.ID)
  }

  if (og.isIndustrialManufacture) {
    categories.push(CategoryID.IM)
  }

  if (og.isIndustrialHighTech) {
    categories.push(CategoryID.IHT)
  }

  return unique(categories)
}

// Looking to match implementation from https://github.com/memo33/submenus-dll/blob/1.1.4/src/Categorization.cpp
function getSubmenus(exemplar: Exemplar): MenuID[] {
  const submenus = getArray(exemplar, ExemplarPropertyID.BuildingSubmenus) ?? []

  // If any submenus are explicit set, return those directly
  if (submenus.length) {
    return submenus as MenuID[]
  }

  // Otherwise, infer from group and other relevant building data
  const capacity = getMap<DeveloperID>(exemplar, ExemplarPropertyID.CapacitySatisfied) ?? {}
  const departments = getArray(exemplar, ExemplarPropertyID.BudgetItemDepartment) ?? []
  const height = get(exemplar, ExemplarPropertyID.OccupantSize, 2) ?? 0
  const isConditional = getBool(exemplar, ExemplarPropertyID.IsConditional) ?? false
  const groups = getArray(exemplar, ExemplarPropertyID.OccupantGroups) ?? []
  const query = get(exemplar, ExemplarPropertyID.QueryExemplarGUID)

  // Mapping for more readability afterwards
  const og = generate(
    values(OccupantGroup).filter(group => isNumber(group)),
    group => [`is${OccupantGroup[group] as keyof typeof OccupantGroup}`, groups.includes(group)],
  )

  if (og.isLandmark && capacity) {
    if (og.isR$) {
      submenus.push(Submenu.Residential_R$)
    }

    if (og.isR$$) {
      submenus.push(Submenu.Residential_R$$)
    }

    if (og.isR$$$) {
      submenus.push(Submenu.Residential_R$$$)
    }

    if (og.isCS$) {
      submenus.push(Submenu.Commercial_CS$)
    }

    if (og.isCS$$) {
      submenus.push(Submenu.Commercial_CS$$)
    }

    if (og.isCS$$$) {
      submenus.push(Submenu.Commercial_CS$$$)
    }

    if (og.isCO$$) {
      submenus.push(Submenu.Commercial_CO$$)
    }

    if (og.isCO$$$) {
      submenus.push(Submenu.Commercial_CO$$$)
    }

    if (og.isAgriculture) {
      submenus.push(Submenu.Industrial_Agriculture)
    }

    if (og.isIndustrialDirty) {
      submenus.push(Submenu.Industrial_Dirty)
    }

    if (og.isIndustrialManufacture) {
      submenus.push(Submenu.Industrial_Manufacture)
    }

    if (og.isIndustrialHighTech) {
      submenus.push(Submenu.Industrial_HighTech)
    }
  }

  if (og.isAirport) {
    // No submenus
  } else if (og.isWaterTransit) {
    if (og.isSeaport || og.isPassengerFerry || og.isCarFerry) {
      submenus.push(Submenu.WaterTransit_Seaports)
    } else if (og.isBteInlandWaterway || og.isSgWaterway) {
      submenus.push(Submenu.WaterTransit_Canals)
    } else if (og.isBteWaterfront) {
      submenus.push(Submenu.WaterTransit_Waterfront)
    }
  } else if (og.isRail) {
    if (og.isLightRail) {
      if (og.isPassengerRail || og.isMonorail) {
        submenus.push(Submenu.MiscTransit_MultiModal)
      }
    } else if (og.isFreightRail) {
      submenus.push(Submenu.Rail_Freight)
    } else if (og.isPassengerRail) {
      if (og.isMonorail) {
        submenus.push(Submenu.Rail_Hybrid)
      } else {
        submenus.push(Submenu.Rail_Passengers)
      }
    } else if (og.isMonorail) {
      submenus.push(Submenu.Rail_Monorail)
    } else {
      submenus.push(Submenu.Rail_Yards)
    }
  } else if (og.isMiscTransit) {
    if (og.isLightRail || og.isPassengerRail || og.isMonorail) {
      if (og.isLightRail) {
        if (og.isPassengerRail || og.isMonorail) {
          submenus.push(Submenu.MiscTransit_MultiModal)
        } else if (height >= 15.5) {
          submenus.push(Submenu.MiscTransit_ElRail)
        } else {
          submenus.push(Submenu.MiscTransit_Tram)
        }
      }
    } else if (og.isSubway) {
      // Not sure what this check is for
      if (capacity) {
        submenus.push(Submenu.MiscTransit_Subway)
      }
    } else if (og.isBus) {
      submenus.push(Submenu.MiscTransit_Bus)
    }
  }

  if (og.isPower) {
    const type = get(exemplar, ExemplarPropertyID.PowerPlantType)

    switch (type) {
      case PowerPlantType.Hydrogen:
      case PowerPlantType.Nuclear:
      case PowerPlantType.Solar:
      case PowerPlantType.Wind:
        submenus.push(Submenu.Power_Clean)
        break

      case PowerPlantType.Coal:
      case PowerPlantType.NaturalGas:
      case PowerPlantType.Oil:
      case PowerPlantType.Waste:
        submenus.push(Submenu.Power_Dirty)
        break

      default:
        submenus.push(Submenu.Power_Misc)
    }
  }

  if (og.isPolice) {
    if (og.isPoliceDeluxe) {
      submenus.push(Submenu.Police_Deluxe)
    } else if (og.isPoliceLarge) {
      submenus.push(Submenu.Police_Large)
    } else if (og.isPoliceSmall || og.isPoliceKiosk) {
      submenus.push(Submenu.Police_Small)
    }
  }

  if (og.isSchool) {
    if (og.isSchoolElementary) {
      submenus.push(Submenu.Education_Elementary)
    } else if (og.isSchoolHigh || og.isSchoolPrivate) {
      // Private schools are with high schools atm
      submenus.push(Submenu.Education_HighSchool)
    }
  }

  if (og.isCollege) {
    submenus.push(Submenu.Education_College)
  }

  if (og.isLibrary || og.isMuseum) {
    // Museums are with libraries atm
    submenus.push(Submenu.Education_Libraries)
  }

  if (og.isHealth) {
    if (og.isHealthOther) {
      if (departments.includes(BudgetItemDepartment.HealthCoverage)) {
        submenus.push(Submenu.Health_Large)
      }
    } else if (og.isHospital) {
      const patients = get(exemplar, ExemplarPropertyID.HospitalPatientCapacity) ?? 0
      if ((og.isClinic || !og.isHealthLarge) && !og.isAmbulanceMaker) {
        submenus.push(Submenu.Health_Small)
      } else if (patients > 20000) {
        submenus.push(Submenu.Health_Large)
      } else {
        submenus.push(Submenu.Health_Medium)
      }
    }
  }

  if (
    departments.includes(BudgetItemDepartment.Government) ||
    og.isMayorHouse ||
    og.isBureaucracy ||
    og.isConventionCrowd ||
    og.isStockExchange ||
    (og.isCourthouse && !og.isLandmark) // to exclude US Capitol
  ) {
    submenus.push(Submenu.Landmarks_Government)
  }

  if (og.isWorship || og.isCemetery || og.isBteReligious) {
    submenus.push(Submenu.Landmarks_Religion)
  }

  if (
    og.isStadium ||
    og.isOpera ||
    og.isNightClub ||
    og.isZoo ||
    og.isStateFair ||
    og.isCasino ||
    og.isTvStation ||
    og.isSgEntertainment ||
    og.isBteEntertainment ||
    query === QueryExemplarGUID.RadioStation
  ) {
    submenus.push(Submenu.Landmarks_Entertainment)
  }

  // Conditional rewards still also appear under Rewards to make them easy to find when unlocked
  if (og.isReward && isConditional) {
    submenus.push(Menu.Rewards)
  }

  return submenus as MenuID[]
}
