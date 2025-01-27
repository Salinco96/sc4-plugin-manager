import { forEach, parseHex, uniqueBy, values } from "@salinco/nice-utils"

import type { BuildingID, BuildingInfo } from "@common/buildings"
import { GroupID, type InstanceID, TypeID, getTextureIdRange } from "@common/dbpf"
import type { FamilyID, FamilyInfo } from "@common/families"
import type { LotID, LotInfo } from "@common/lots"
import type { FloraID, FloraInfo } from "@common/mmps"
import type { PropID, PropInfo } from "@common/props"
import type { Index } from "@common/state"
import type { TextureID, VariantInfo } from "@common/variants"

export interface MatchResult {
  element: string
  name: string
  tab?: string
  type: string
}

export function isHexSearch(search: string): boolean {
  return !!search.match(/^[ ]*[0-9a-f]{8}(-[0-9a-f]{8})?(-[0-9a-f]{0,8})?[ ]*$/i)
}

export function toHexSearch(search: string): string {
  return search.toLowerCase().trim()
}

function matchBuildingFamily(family: FamilyInfo, search: string): MatchResult | undefined {
  if (family.id === search) {
    return {
      element: `buildingFamily-${family.id}`,
      name: family.name ?? family.id,
      tab: "lots",
      type: "Building family",
    }
  }

  if (family.group && `${family.group}-${family.id}`.startsWith(search)) {
    return {
      element: `buildingFamily-${family.id}`,
      name: family.name ?? family.id,
      tab: "lots",
      type: "Building family",
    }
  }

  if (search.length > 9) {
    if (family.group && `${TypeID.COHORT}-${family.group}-${family.id}`.startsWith(search)) {
      return {
        element: `buildingFamily-${family.id}`,
        name: family.name ?? family.id,
        tab: "lots",
        type: "Building family",
      }
    }
  }
}

function matchBuilding(building: BuildingInfo, search: string): MatchResult | undefined {
  if (building.id === search) {
    return {
      element: `building-${building.id}`,
      name: building.name ?? building.id,
      tab: "lots",
      type: "Building",
    }
  }

  if (`${building.group}-${building.id}`.startsWith(search)) {
    return {
      element: `building-${building.id}`,
      name: building.name ?? building.id,
      tab: "lots",
      type: "Building",
    }
  }

  if (search.length > 9) {
    if (`${TypeID.EXEMPLAR}-${building.group}-${building.id}`.startsWith(search)) {
      return {
        element: `building-${building.id}`,
        name: building.name ?? building.id,
        tab: "lots",
        type: "Building",
      }
    }
  }

  if (building.families?.includes(search as FamilyID)) {
    return {
      element: `buildingFamily-${search}`,
      name: search,
      tab: "lots",
      type: "Buildings with family",
    }
  }
}

function matchFlora(mmp: FloraInfo, search: string): MatchResult | undefined {
  if (mmp.id === search) {
    return {
      element: `mmp-${mmp.id}`,
      name: mmp.name ?? mmp.id,
      tab: "mmps",
      type: "MMP",
    }
  }

  if (`${mmp.group}-${mmp.id}`.startsWith(search)) {
    return {
      element: `mmp-${mmp.id}`,
      name: mmp.name ?? mmp.id,
      tab: "mmps",
      type: "MMP",
    }
  }

  if (search.length > 9) {
    if (`${TypeID.EXEMPLAR}-${mmp.group}-${mmp.id}`.startsWith(search)) {
      return {
        element: `mmp-${mmp.id}`,
        name: mmp.name ?? mmp.id,
        tab: "mmps",
        type: "MMP",
      }
    }
  }

  if (mmp.stages) {
    for (const stage of mmp.stages) {
      if (stage.id === search) {
        return {
          element: `mmp-${stage.id}`,
          name: stage.name ?? stage.id,
          tab: "mmps",
          type: "MMP",
        }
      }

      if (`${mmp.group}-${stage.id}`.startsWith(search)) {
        return {
          element: `mmp-${stage.id}`,
          name: stage.name ?? stage.id,
          tab: "mmps",
          type: "MMP",
        }
      }

      if (search.length > 9) {
        if (`${TypeID.EXEMPLAR}-${mmp.group}-${stage.id}`.startsWith(search)) {
          return {
            element: `mmp-${stage.id}`,
            name: stage.name ?? stage.id,
            tab: "mmps",
            type: "MMP",
          }
        }
      }
    }
  }
}

function matchLot(lot: LotInfo, search: string): MatchResult | undefined {
  if (lot.id === search) {
    return {
      element: `lot-${lot.id}`,
      name: lot.name ?? lot.id,
      tab: "lots",
      type: "Lot",
    }
  }

  if (search.length > 9) {
    if (`${GroupID.LOT_CONFIG}-${lot.id}`.startsWith(search)) {
      return {
        element: `lot-${lot.id}`,
        name: lot.name ?? lot.id,
        tab: "lots",
        type: "Lot",
      }
    }
  }

  if (search.length > 18) {
    if (`${TypeID.EXEMPLAR}-${GroupID.LOT_CONFIG}-${lot.id}`.startsWith(search)) {
      return {
        element: `lot-${lot.id}`,
        name: lot.name ?? lot.id,
        tab: "lots",
        type: "Lot",
      }
    }
  }
}

function matchModel(id: `${GroupID}-${InstanceID}`, search: string): MatchResult | undefined {
  if (id.startsWith(search)) {
    return {
      element: `model-${id}`,
      name: id,
      // tab: "models",
      type: "Model",
    }
  }

  if (search.length > 9) {
    if (`${TypeID.S3D}-${id}`.startsWith(search)) {
      return {
        element: `model-${id}`,
        name: id,
        // tab: "models",
        type: "Model",
      }
    }
  }
}

function matchPropFamily(family: FamilyInfo, search: string): MatchResult | undefined {
  if (family.id === search) {
    return {
      element: `propFamily-${family.id}`,
      name: family.name ?? family.id,
      tab: "props",
      type: "Prop family",
    }
  }

  if (family.group && `${family.group}-${family.id}`.startsWith(search)) {
    return {
      element: `propFamily-${family.id}`,
      name: family.name ?? family.id,
      tab: "props",
      type: "Prop family",
    }
  }

  if (search.length > 9) {
    if (family.group && `${TypeID.COHORT}-${family.group}-${family.id}`.startsWith(search)) {
      return {
        element: `propFamily-${family.id}`,
        name: family.name ?? family.id,
        tab: "props",
        type: "Prop family",
      }
    }
  }
}

function matchProp(prop: PropInfo, search: string): MatchResult | undefined {
  if (prop.id === search) {
    return {
      element: `prop-${prop.id}`,
      name: prop.name ?? prop.id,
      tab: "props",
      type: "Prop",
    }
  }

  if (`${prop.group}-${prop.id}`.startsWith(search)) {
    return {
      element: `prop-${prop.id}`,
      name: prop.name ?? prop.id,
      tab: "props",
      type: "Prop",
    }
  }

  if (search.length > 9) {
    if (`${TypeID.EXEMPLAR}-${prop.group}-${prop.id}`.startsWith(search)) {
      return {
        element: `prop-${prop.id}`,
        name: prop.name ?? prop.id,
        tab: "props",
        type: "Prop",
      }
    }
  }

  if (prop.families?.includes(search as FamilyID)) {
    return {
      element: `propFamily-${search}`,
      name: search,
      tab: "props",
      type: "Props with family",
    }
  }
}

function matchTexture(
  id: InstanceID,
  search: string,
  searchRange?: [InstanceID, InstanceID],
): MatchResult | undefined {
  if (searchRange && id === searchRange[0]) {
    return {
      element: `texture-${searchRange[0]}`,
      name: searchRange.join(" ... "),
      tab: "textures",
      type: "Texture",
    }
  }

  if (search.length > 9) {
    const fixedSearch = searchRange ? search.slice(0, 9) + searchRange[0] : search
    if (`${GroupID.FSH_TEXTURE}-${id}`.startsWith(fixedSearch)) {
      const range = searchRange ?? getTextureIdRange(id)

      return {
        element: `texture-${range[0]}`,
        name: range.join(" ... "),
        tab: "textures",
        type: "Texture",
      }
    }
  }

  if (search.length > 18) {
    const fixedSearch = searchRange ? search.slice(0, 18) + searchRange[0] : search

    if (`${TypeID.FSH}-${GroupID.FSH_TEXTURE}-${id}`.startsWith(fixedSearch)) {
      const range = searchRange ?? getTextureIdRange(id)

      return {
        element: `texture-${range[0]}`,
        name: range.join(" ... "),
        tab: "textures",
        type: "Texture",
      }
    }
  }
}

function getTextureSearchRange(search: string): [InstanceID, InstanceID] | undefined {
  return [8, 17, 26].includes(search.length)
    ? getTextureIdRange(parseHex(search.slice(-8)))
    : undefined
}

export function hasMatchingContents(contents: VariantInfo, search: string): boolean {
  if (contents.buildingFamilies?.some(family => matchBuildingFamily(family, search))) {
    return true
  }

  if (contents.buildings?.some(building => matchBuilding(building, search))) {
    return true
  }

  if (contents.lots?.some(lot => matchLot(lot, search))) {
    return true
  }

  if (contents.mmps?.some(mmp => matchFlora(mmp, search))) {
    return true
  }

  if (contents.models) {
    for (const models of values(contents.models)) {
      if (models?.some(id => matchModel(id, search))) {
        return true
      }
    }
  }

  if (contents.propFamilies?.some(family => matchPropFamily(family, search))) {
    return true
  }

  if (contents.props?.some(prop => matchProp(prop, search))) {
    return true
  }

  if (contents.textures) {
    const searchRange = getTextureSearchRange(search)
    for (const textures of values(contents.textures)) {
      if (textures?.some(id => matchTexture(id, search, searchRange))) {
        return true
      }
    }
  }

  return false
}

export function getMatchingContents(contents: VariantInfo, search: string): MatchResult[] {
  const results: MatchResult[] = []

  if (contents.buildingFamilies) {
    for (const family of contents.buildingFamilies) {
      const result = matchBuildingFamily(family, search)
      if (result) {
        results.push(result)
      }
    }
  }

  if (contents.buildings) {
    for (const building of contents.buildings) {
      const result = matchBuilding(building, search)
      if (result) {
        results.push(result)
      }
    }
  }

  if (contents.lots) {
    for (const lot of contents.lots) {
      const result = matchLot(lot, search)
      if (result) {
        results.push(result)
      }
    }
  }

  if (contents.mmps) {
    for (const mmp of contents.mmps) {
      const result = matchFlora(mmp, search)
      if (result) {
        results.push(result)
      }
    }
  }

  if (contents.models) {
    for (const models of values(contents.models)) {
      for (const id of models) {
        const result = matchModel(id, search)
        if (result) {
          results.push(result)
        }
      }
    }
  }

  if (contents.propFamilies) {
    for (const family of contents.propFamilies) {
      const result = matchPropFamily(family, search)
      if (result) {
        results.push(result)
      }
    }
  }

  if (contents.props) {
    for (const prop of contents.props) {
      const result = matchProp(prop, search)
      if (result) {
        results.push(result)
      }
    }
  }

  if (contents.textures) {
    const searchRange = getTextureSearchRange(search)
    for (const textures of values(contents.textures)) {
      for (const id of textures) {
        const result = matchTexture(id, search, searchRange)
        if (result) {
          results.push(result)
        }
      }
    }
  }

  return uniqueBy(results, result => result.element)
}

export function searchIndex(index: Index, search: string): { [path: string]: MatchResult[] } {
  const results: { [path: string]: MatchResult[] } = {}

  const parts = search.split("-")

  function searchBuildingFamilies(familyId: FamilyID): void {
    const family = index.buildingFamilies[familyId]
    if (family?.family?.file) {
      results[family.family.file] ??= []
      results[family.family.file].push({
        element: `buildingFamily-${familyId}`,
        name: family.family.name ?? familyId,
        tab: "lots",
        type: "Building family",
      })
    }

    if (family?.buildings) {
      for (const building of family.buildings) {
        results[building.file] ??= []
        results[building.file].push({
          element: `buildingFamily-${familyId}`,
          name: building.name ?? building.id,
          tab: "lots",
          type: "Building with family",
        })
      }
    }
  }

  function searchBuildings(buildingId: BuildingID, groupId?: GroupID): void {
    const buildings = index.buildings[buildingId]
    if (buildings) {
      for (const building of buildings) {
        if (!groupId || building.group === groupId) {
          results[building.file] ??= []
          results[building.file].push({
            element: `building-${buildingId}`,
            name: building.name ?? buildingId,
            tab: "lots",
            type: "Building",
          })
        }
      }
    }
  }

  function searchLots(lotId: LotID): void {
    const lots = index.lots[lotId]
    if (lots) {
      for (const lot of lots) {
        results[lot.file] ??= []
        results[lot.file].push({
          element: `lot-${lotId}`,
          name: lot.name ?? lotId,
          tab: "lots",
          type: "Lot",
        })
      }
    }
  }

  function searchMMPs(mmpId: FloraID, groupId?: GroupID): void {
    const mmps = index.mmps[mmpId]
    if (mmps) {
      for (const mmp of mmps) {
        if (!groupId || mmp.group === groupId) {
          const stage = mmp.id === mmpId ? mmp : mmp.stages?.find(stage => stage.id === mmpId)
          results[mmp.file] ??= []
          results[mmp.file].push({
            element: `mmp-${mmpId}`,
            name: stage?.name ?? mmpId,
            tab: "mmps",
            type: "MMP",
          })
        }
      }
    }
  }

  function searchModels(groupId: GroupID, instanceId?: string): void {
    const models = index.models[groupId]
    if (models) {
      if (instanceId && instanceId.length >= 4) {
        const normalizedInstanceId = instanceId.slice(0, 4).padEnd(8, "0") as InstanceID
        const paths = models[normalizedInstanceId]
        if (paths) {
          for (const path of paths) {
            results[path] ??= []
            results[path].push({
              element: `model-${groupId}-${normalizedInstanceId}`,
              name: `${groupId}-${normalizedInstanceId}`,
              // tab: "models",
              type: "Model",
            })
          }
        }
      } else {
        forEach(models, (paths, normalizedInstanceId) => {
          if (!instanceId || normalizedInstanceId.startsWith(instanceId)) {
            for (const path of paths) {
              results[path] ??= []
              results[path].push({
                element: `model-${groupId}-${normalizedInstanceId}`,
                name: `${groupId}-${normalizedInstanceId}`,
                // tab: "models",
                type: "Model",
              })
            }
          }
        })
      }
    }
  }

  function searchPropFamilies(familyId: FamilyID): void {
    const family = index.propFamilies[familyId]
    if (family?.family?.file) {
      results[family.family.file] ??= []
      results[family.family.file].push({
        element: `propFamily-${familyId}`,
        name: family.family.name ?? familyId,
        tab: "props",
        type: "Prop family",
      })
    }

    if (family?.props) {
      for (const prop of family.props) {
        results[prop.file] ??= []
        results[prop.file].push({
          element: `propFamily-${familyId}`,
          name: prop.name ?? prop.id,
          tab: "props",
          type: "Prop in family",
        })
      }
    }
  }

  function searchProps(propId: PropID, groupId?: GroupID): void {
    const props = index.props[propId]
    if (props) {
      for (const prop of props) {
        if (!groupId || prop.group === groupId) {
          results[prop.file] ??= []
          results[prop.file].push({
            element: `prop-${propId}`,
            name: prop.name ?? propId,
            tab: "lots",
            type: "Prop",
          })
        }
      }
    }
  }

  function searchTextures(textureId: TextureID): void {
    const searchRange = getTextureIdRange(textureId)
    const paths = index.textures[searchRange[0]]
    if (paths) {
      for (const path of paths) {
        results[path] ??= []
        results[path].push({
          element: `texture-${searchRange[0]}`,
          name: searchRange.join(" ... "),
          tab: "textures",
          type: "Texture",
        })
      }
    }
  }

  switch (parts.length) {
    case 1: {
      searchBuildingFamilies(search as FamilyID)
      searchBuildings(search as BuildingID)
      searchLots(search as LotID)
      searchMMPs(search as FloraID)
      searchModels(search as GroupID)
      searchPropFamilies(search as FamilyID)
      searchProps(search as PropID)
      searchTextures(search as TextureID)
      break
    }

    case 2: {
      const [groupId, instanceId] = parts as [GroupID, InstanceID]
      searchModels(groupId, instanceId)
      if (instanceId.length === 8) {
        searchBuildings(instanceId as BuildingID, groupId)
        searchMMPs(instanceId as FloraID, groupId)
        searchProps(instanceId as PropID, groupId)
        if (groupId === GroupID.LOT_CONFIG) {
          searchLots(instanceId as LotID)
        } else if (groupId === GroupID.FSH_TEXTURE) {
          searchTextures(instanceId as TextureID)
        }
      }

      break
    }

    case 3: {
      const [typeId, groupId, instanceId] = parts as [TypeID, GroupID, InstanceID]
      if (typeId === TypeID.S3D) {
        searchModels(groupId, instanceId)
      } else if (instanceId.length === 8) {
        if (typeId === TypeID.FSH && groupId === GroupID.FSH_TEXTURE) {
          searchTextures(instanceId as TextureID)
        } else if (typeId === TypeID.EXEMPLAR) {
          searchBuildings(instanceId as BuildingID, groupId)
          searchMMPs(instanceId as FloraID, groupId)
          searchProps(instanceId as PropID, groupId)
          if (groupId === GroupID.LOT_CONFIG) {
            searchLots(instanceId as LotID)
          }
        }
      }
      break
    }
  }

  return results
}
