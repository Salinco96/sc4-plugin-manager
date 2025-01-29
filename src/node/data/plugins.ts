import type { BuildingID } from "@common/buildings"
import type { Categories } from "@common/categories"
import { type GroupID, InstanceID } from "@common/dbpf"
import type { FamilyID } from "@common/families"
import type { LotID } from "@common/lots"
import type { FileContents, FileContentsInfo } from "@common/plugins"
import type { PropID } from "@common/props"
import { split } from "@common/utils/string"
import type { ModelID, TextureID, VariantContentsInfo } from "@common/variants"
import { collect, isEmpty, mapValues, sort, values } from "@salinco/nice-utils"
import { type BuildingData, loadBuildingInfo, writeBuildingInfo } from "./buildings"
import { type FamilyData, loadFamilyInfo, writeFamilyInfo } from "./families"
import { type LotData, loadLotInfo, writeLotInfo } from "./lots"
import { type FloraData, loadFloraInfo, writeFloraInfo } from "./mmps"
import { type PropData, loadPropInfo, writePropInfo } from "./props"

export type FileContentsData = {
  /**
   * Included building family exemplars, grouped by file and instance ID
   */
  buildingFamilies?: {
    [id in `${GroupID}-${FamilyID}`]?: FamilyData
  }

  /**
   * Included building exemplars, grouped by file and instance ID
   */
  buildings?: {
    [id in `${GroupID}-${BuildingID}`]?: BuildingData
  }

  /**
   * Included lot exemplars, grouped by file and instance ID
   */
  lots?: {
    [id in LotID]?: LotData
  }

  /**
   * Included flora exemplars, grouped by file and instance ID
   */
  mmps?: {
    [id in `${GroupID}-${BuildingID}`]?: FloraData
  }

  /**
   * Included S3D model IDs, grouped by file
   */
  models?: Array<GroupID | `${GroupID}-${string}`>

  /**
   * Included prop family exemplars, grouped by file and instance ID
   */
  propFamilies?: {
    [id in `${GroupID}-${FamilyID}`]?: FamilyData
  }

  /**
   * Included prop exemplars, grouped by file and instance ID
   */
  props?: {
    [id in `${GroupID}-${PropID}`]?: PropData
  }

  /**
   * Included FSH texture IDs, grouped by file
   */
  textures?: TextureID[]
}

export function loadContents(
  data: { [path in string]?: FileContentsData },
  categories: Categories,
): FileContents {
  return mapValues(data, (data, file) => loadContentsInfo(file, data, categories))
}

function loadContentsInfo(
  file: string,
  data: FileContentsData,
  categories: Categories,
): FileContentsInfo {
  return {
    buildingFamilies:
      data.buildingFamilies &&
      collect(data.buildingFamilies, (data, id) => {
        const [groupId, instanceId] = split(id, "-")
        return loadFamilyInfo(file, groupId, instanceId, data)
      }),
    buildings:
      data.buildings &&
      collect(data.buildings, (data, id) => {
        const [groupId, instanceId] = split(id, "-")
        return loadBuildingInfo(file, groupId, instanceId, data, categories)
      }),
    lots:
      data.lots &&
      collect(data.lots, (data, id) => {
        return loadLotInfo(file, id, data)
      }),
    mmps:
      data.mmps &&
      collect(data.mmps, (data, id) => {
        const [groupId, instanceId] = split(id, "-")
        return loadFloraInfo(file, groupId, instanceId, data)
      }),
    models: data.models?.map(loadModelId),
    propFamilies:
      data.propFamilies &&
      collect(data.propFamilies, (data, id) => {
        const [groupId, instanceId] = split(id, "-")
        return loadFamilyInfo(file, groupId, instanceId, data)
      }),
    props:
      data.props &&
      collect(data.props, (data, id) => {
        const [groupId, instanceId] = split(id, "-")
        return loadPropInfo(file, groupId, instanceId, data)
      }),
    textures: data.textures,
  }
}

export function writeContents(
  contents: FileContents,
  categories: Categories,
): { [path in string]?: FileContentsData } {
  return mapValues(contents, contents =>
    isEmpty(contents) ? undefined : writeContentsInfo(contents, categories),
  )
}

function writeContentsInfo(contents: FileContentsInfo, categories: Categories): FileContentsData {
  const data: FileContentsData = {}

  if (contents.buildingFamilies) {
    for (const buildingFamily of contents.buildingFamilies) {
      const { file, group, id } = buildingFamily
      if (file && group) {
        data.buildingFamilies ??= {}
        data.buildingFamilies[`${group}-${id}`] ??= writeFamilyInfo(buildingFamily)
      }
    }
  }

  if (contents.buildings) {
    for (const building of contents.buildings) {
      const { group, id } = building

      data.buildings ??= {}
      data.buildings[`${group}-${id}`] ??= writeBuildingInfo(building, categories)
    }
  }

  if (contents.lots) {
    for (const lot of contents.lots) {
      const { id } = lot

      data.lots ??= {}
      data.lots[id] ??= writeLotInfo(lot)
    }
  }

  if (contents.mmps) {
    for (const mmp of contents.mmps) {
      const { group, id } = mmp

      data.mmps ??= {}
      data.mmps[`${group}-${id}`] ??= writeFloraInfo(mmp)
    }
  }

  if (contents.models?.length) {
    data.models = sort(contents.models.map(writeModelId))
  }

  if (contents.propFamilies) {
    for (const propFamily of contents.propFamilies) {
      const { file, group, id } = propFamily
      if (file && group) {
        data.propFamilies ??= {}
        data.propFamilies[`${group}-${id}`] ??= writeFamilyInfo(propFamily)
      }
    }
  }

  if (contents.props) {
    for (const prop of contents.props) {
      const { group, id } = prop

      data.props ??= {}
      data.props[`${group}-${id}`] ??= writePropInfo(prop)
    }
  }

  if (contents.textures?.length) {
    data.textures = sort(contents.textures)
  }

  return data
}

export function loadModelId(id: GroupID | `${GroupID}-${string}`): ModelID {
  const [groupId, instanceId = InstanceID.S3D] = split(id, "-") as [GroupID, string?]
  return `${groupId}-${instanceId.padEnd(8, "0") as InstanceID}`
}

export function writeModelId(id: ModelID): GroupID | `${GroupID}-${string}` {
  const [groupId, instanceId] = split(id, "-")
  return instanceId === InstanceID.S3D ? groupId : `${groupId}-${instanceId.slice(0, 4)}`
}

export function toVariantContentsInfo(contents: FileContents): VariantContentsInfo {
  return {
    buildingFamilies: values(contents).flatMap(contents => contents.buildingFamilies ?? []),
    buildings: values(contents).flatMap(contents => contents.buildings ?? []),
    lots: values(contents).flatMap(contents => contents.lots ?? []),
    mmps: values(contents).flatMap(contents => contents.mmps ?? []),
    models: mapValues(contents, contents => contents.models),
    propFamilies: values(contents).flatMap(contents => contents.propFamilies ?? []),
    props: values(contents).flatMap(contents => contents.props ?? []),
    textures: mapValues(contents, contents => contents.textures),
  }
}
