import { toHex, values } from "@salinco/nice-utils"

import type { BuildingID } from "@common/buildings"
import { type GroupID, type TypeID, getTextureIdRange } from "@common/dbpf"
import { ExemplarPropertyID } from "@common/exemplars"
import { type LotID, type LotInfo, ZoneDensity } from "@common/lots"
import type { PropID } from "@common/props"

import { split } from "@common/utils/string"
import type { TextureID } from "@common/variants"
import { type Exemplar, LotConfigPropertyType, ZoneType } from "./types"
import { get, getArray, getString } from "./utils"

export function getLotInfo(exemplar: Exemplar): LotInfo {
  const [, , id] = split(exemplar.id, "-") as [TypeID, GroupID, LotID]

  const data: LotInfo = {
    file: exemplar.file,
    id,
  }

  if (exemplar.file.match(/\bCAM\b/i)) {
    data.requirements ??= {}
    data.requirements.cam = true
  }

  const zones = getArray(exemplar, ExemplarPropertyID.ZoneTypes) ?? []

  const isPlop = !zones.some(
    zone => zone >= ZoneType.ResidentialLow && zone <= ZoneType.IndustrialHigh,
  )

  const densities: ZoneDensity[] = []

  if (
    zones.includes(ZoneType.ResidentialLow) ||
    zones.includes(ZoneType.CommercialLow) ||
    zones.includes(ZoneType.IndustrialLow)
  ) {
    densities.push(ZoneDensity.LOW)
  }

  if (
    zones.includes(ZoneType.ResidentialMedium) ||
    zones.includes(ZoneType.CommercialMedium) ||
    zones.includes(ZoneType.IndustrialMedium)
  ) {
    densities.push(ZoneDensity.MEDIUM)
  }

  if (
    zones.includes(ZoneType.ResidentialHigh) ||
    zones.includes(ZoneType.CommercialHigh) ||
    zones.includes(ZoneType.IndustrialHigh)
  ) {
    densities.push(ZoneDensity.HIGH)
  }

  if (densities.length) {
    data.density = densities
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

    if (stage > 8 && stage <= 32) {
      data.requirements ??= {}
      data.requirements.cam = true
    }
  }

  const lotConfigProperties = values(exemplar.data.properties).filter(
    property =>
      property.id >= ExemplarPropertyID.LotConfigPropertyFirst &&
      property.id <= ExemplarPropertyID.LotConfigPropertyLast,
  )

  const props = new Set<PropID>()
  const textures = new Set<TextureID>()

  for (const lotConfigProperty of lotConfigProperties) {
    const value = lotConfigProperty.value as number[]

    const type = value[0] as LotConfigPropertyType
    const instanceIds = value.slice(12)

    switch (type) {
      case LotConfigPropertyType.Building: {
        data.building = toHex(instanceIds[0], 8) as BuildingID
        break
      }

      case LotConfigPropertyType.Prop: {
        for (const instanceId of instanceIds) {
          props.add(toHex(instanceId, 8) as PropID)
        }

        break
      }

      case LotConfigPropertyType.Texture: {
        for (const instanceId of instanceIds) {
          textures.add(getTextureIdRange(instanceId)[0])
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
