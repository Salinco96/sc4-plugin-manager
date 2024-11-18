import { CategoryID } from "@common/categories"
import { LotData } from "@common/types"
import { toHex } from "@common/utils/hex"
import { values } from "@common/utils/objects"

import {
  Exemplar,
  ExemplarPropertyID,
  LotConfigPropertyType,
  PurposeType,
  WealthType,
  ZoneType,
} from "./types"
import { get, getArray, getBaseTextureId, getString } from "./utils"

export function getLotData(exemplar: Exemplar): LotData {
  const lotId = exemplar.id.split("-")[2]

  const data: LotData = { id: lotId }

  data.filename = exemplar.file

  if (exemplar.file.match(/\bCAM\b/i)) {
    data.requirements ??= {}
    data.requirements.cam = true
  }

  const wealth = get(exemplar, ExemplarPropertyID.WealthTypes) || 0
  const purpose = get(exemplar, ExemplarPropertyID.PurposeTypes) || 0
  const zones = getArray(exemplar, ExemplarPropertyID.ZoneTypes)

  const isPlop = !zones.some(
    zone => zone >= ZoneType.ResidentialLow && zone <= ZoneType.IndustrialHigh,
  )

  const categories: string[] = []

  if (zones.includes(ZoneType.Landmark)) {
    categories.push(CategoryID.LANDMARKS)
  }

  switch (purpose) {
    case PurposeType.Residential:
      switch (wealth) {
        case WealthType.$:
          categories.push("r$")
          break

        case WealthType.$$:
          categories.push("r$$")
          break

        case WealthType.$$$:
          categories.push("r$$$")
          break

        default:
          categories.push(CategoryID.RESIDENTIAL)
      }

      break
    case PurposeType.CommercialServices:
      switch (wealth) {
        case WealthType.$:
          categories.push("cs$")
          break

        case WealthType.$$:
          categories.push("cs$$")
          break

        case WealthType.$$$:
          categories.push("cs$$$")
          break

        default:
          categories.push(CategoryID.COMMERCIAL)
      }

      break
    case PurposeType.CommercialOffices:
      switch (wealth) {
        case WealthType.$$:
          categories.push("co$$")
          break

        case WealthType.$$$:
          categories.push("co$$$")
          break

        default:
          categories.push(CategoryID.COMMERCIAL)
      }

      break
    case PurposeType.Agriculture:
      categories.push(CategoryID.AGRICULTURE)

      break
    case PurposeType.IndustrialDirty:
      categories.push("i-d")

      break
    case PurposeType.IndustrialManufacture:
      categories.push("i-m")

      break
    case PurposeType.IndustrialHighTech:
      categories.push("i-ht")
  }

  if (categories.length) {
    data.category = categories.join(",")
  }

  const densities: string[] = []

  if (
    zones.includes(ZoneType.ResidentialLow) ||
    zones.includes(ZoneType.CommercialLow) ||
    zones.includes(ZoneType.IndustrialLow)
  ) {
    densities.push("low")
  }

  if (
    zones.includes(ZoneType.ResidentialMedium) ||
    zones.includes(ZoneType.CommercialMedium) ||
    zones.includes(ZoneType.IndustrialMedium)
  ) {
    densities.push("medium")
  }

  if (
    zones.includes(ZoneType.ResidentialHigh) ||
    zones.includes(ZoneType.CommercialHigh) ||
    zones.includes(ZoneType.IndustrialHigh)
  ) {
    densities.push("high")
  }

  if (densities.length) {
    data.density = densities.join(",")
  }

  const lotName = getString(exemplar, ExemplarPropertyID.ExemplarName)
  if (lotName?.length) {
    data.name = lotName
  }

  const sizeX = get(exemplar, ExemplarPropertyID.LotSize, 0)
  const sizeY = get(exemplar, ExemplarPropertyID.LotSize, 1)
  if (sizeX && sizeY) {
    data.size = `${sizeX}x${sizeY}`
  }

  const stage = get(exemplar, ExemplarPropertyID.GrowthStage)
  if (stage && !isPlop) {
    data.stage = stage
  }

  const lotConfigProperties = values(exemplar.data.properties).filter(
    property =>
      property.id >= ExemplarPropertyID.LotConfigPropertyFirst &&
      property.id <= ExemplarPropertyID.LotConfigPropertyLast,
  )

  const props = new Set<string>()
  const textures = new Set<string>()

  for (const lotConfigProperty of lotConfigProperties) {
    const value = lotConfigProperty.value as number[]

    const type = value[0] as LotConfigPropertyType
    const instanceIds = value.slice(12)

    switch (type) {
      case LotConfigPropertyType.Building: {
        data.building = toHex(instanceIds[0], 8)
        break
      }

      case LotConfigPropertyType.Prop: {
        for (const instanceId of instanceIds) {
          props.add(toHex(instanceId, 8))
        }

        break
      }

      case LotConfigPropertyType.Texture: {
        for (const instanceId of instanceIds) {
          textures.add(getBaseTextureId(instanceId))
        }

        break
      }
    }
  }

  if (props.size) {
    data.props = Array.from(props)
  }

  if (textures.size) {
    data.textures = Array.from(textures)
  }

  return data
}
