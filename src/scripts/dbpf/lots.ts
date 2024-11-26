import type { LotData } from "@common/types"
import { toHex, values } from "@salinco/nice-utils"

import { type Exemplar, ExemplarPropertyID, LotConfigPropertyType, ZoneType } from "./types"
import { get, getArray, getBaseTextureId, getString } from "./utils"

export function getLotData(exemplar: Exemplar): LotData {
  const lotId = exemplar.id.split("-")[2]

  const data: LotData = { id: lotId, filename: exemplar.file }

  if (exemplar.file.match(/\bCAM\b/i)) {
    data.requirements ??= {}
    data.requirements.cam = true
  }

  const zones = getArray(exemplar, ExemplarPropertyID.ZoneTypes) ?? []

  const isPlop = !zones.some(
    zone => zone >= ZoneType.ResidentialLow && zone <= ZoneType.IndustrialHigh,
  )

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

  const name = getString(exemplar, ExemplarPropertyID.ExemplarName)
  if (name?.length) {
    data.name = name
  }

  const sizeX = get(exemplar, ExemplarPropertyID.LotSize, 0)
  const sizeY = get(exemplar, ExemplarPropertyID.LotSize, 1)
  if (sizeX && sizeY) {
    data.size = `${sizeX}x${sizeY}`
  }

  const stage = get(exemplar, ExemplarPropertyID.GrowthStage)
  if (stage && !isPlop) {
    data.stage = stage

    if (stage > 8) {
      data.requirements ??= {}
      data.requirements.cam = true
    }
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
