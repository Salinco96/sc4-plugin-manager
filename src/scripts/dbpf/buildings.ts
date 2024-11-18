import { BuildingData } from "@common/types"
import { sum } from "@common/utils/arrays"

import { DeveloperID, Exemplar, ExemplarPropertyID } from "./types"
import { get, getArray, getMap, getString, getTGI } from "./utils"

export function getBuildingData(exemplar: Exemplar): BuildingData {
  const buildingId = exemplar.id.split("-")[2]

  const data: BuildingData = { id: buildingId }

  data.filename = exemplar.file

  const plopCost = get(exemplar, ExemplarPropertyID.PlopCost)
  if (plopCost) {
    data.cost = plopCost
  }

  const maintenanceCost = sum(getArray(exemplar, ExemplarPropertyID.BudgetItemCost))
  if (maintenanceCost) {
    data.maintenance = maintenanceCost
  }

  const bulldozeCost = get(exemplar, ExemplarPropertyID.BulldozeCost)
  if (bulldozeCost) {
    data.bulldoze = bulldozeCost
  }

  const label = getString(exemplar, ExemplarPropertyID.ItemLabel)
  if (label?.length) {
    data.label = label
  }

  const description = getString(exemplar, ExemplarPropertyID.ItemDescription)
  if (description?.length) {
    data.description = description
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

  const model =
    getTGI(exemplar, ExemplarPropertyID.ResourceKeyType0) ??
    getTGI(exemplar, ExemplarPropertyID.ResourceKeyType1)
  if (model) {
    data.model = model
  }

  const capacity = getMap<DeveloperID>(exemplar, ExemplarPropertyID.CapacitySatisfied)

  if (capacity) {
    data.capacity = {
      r$: capacity[DeveloperID.R$],
      r$$: capacity[DeveloperID.R$$],
      r$$$: capacity[DeveloperID.R$$$],
      cs$: capacity[DeveloperID.CS$],
      cs$$: capacity[DeveloperID.CS$$],
      cs$$$: capacity[DeveloperID.CS$$$],
      co$$: capacity[DeveloperID.CO$$],
      co$$$: capacity[DeveloperID.CO$$$],
      ir: capacity[DeveloperID.IR],
      id: capacity[DeveloperID.ID],
      im: capacity[DeveloperID.IM],
      iht: capacity[DeveloperID.IHT],
    }
  }

  return data
}
