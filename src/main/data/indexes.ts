import type { Index } from "@common/state"
import { split } from "@common/utils/string"
import type { Contents } from "@common/variants"
import { forEach } from "@salinco/nice-utils"

export function calculateIndex(contents: Contents): Index {
  const index: Index = {
    buildingFamilies: {},
    buildings: {},
    lots: {},
    mmps: {},
    models: {},
    propFamilies: {},
    props: {},
    textures: {},
  }

  forEach(contents, (contents, file) => {
    if (contents.buildingFamilies) {
      for (const family of contents.buildingFamilies) {
        const familyId = family.id

        index.buildingFamilies[familyId] ??= { buildings: [] }

        if (family.file) {
          index.buildingFamilies[familyId].family = family
        }
      }
    }

    if (contents.buildings) {
      for (const building of contents.buildings) {
        const buildingId = building.id
        index.buildings[buildingId] ??= []
        index.buildings[buildingId].unshift(building)

        if (building.families) {
          for (const familyId of building.families) {
            index.buildingFamilies[familyId] ??= { buildings: [] }
            index.buildingFamilies[familyId].buildings.unshift(building)
          }
        }
      }
    }

    if (contents.lots) {
      for (const lot of contents.lots) {
        const lotId = lot.id
        index.lots[lotId] ??= []
        index.lots[lotId].unshift(lot)
      }
    }

    if (contents.mmps) {
      for (const mmp of contents.mmps) {
        const mmpId = mmp.id
        index.mmps[mmpId] ??= []
        index.mmps[mmpId].unshift(mmp)

        if (mmp.stages) {
          for (const stage of mmp.stages) {
            const stageId = stage.id
            index.mmps[stageId] ??= []
            index.mmps[stageId].unshift(mmp)
          }
        }
      }
    }

    if (contents.models) {
      for (const modelId of contents.models) {
        const [groupId, instanceId] = split(modelId, "-")
        index.models[groupId] ??= {}
        index.models[groupId][instanceId] ??= []
        index.models[groupId][instanceId].unshift(file)
      }
    }

    if (contents.propFamilies) {
      for (const family of contents.propFamilies) {
        const familyId = family.id

        index.propFamilies[familyId] ??= { props: [] }

        if (family.file) {
          index.propFamilies[familyId].family = family
        }
      }
    }

    if (contents.props) {
      for (const prop of contents.props) {
        const propId = prop.id
        index.props[propId] ??= []
        index.props[propId].unshift(prop)

        if (prop.families) {
          for (const familyId of prop.families) {
            index.propFamilies[familyId] ??= { props: [] }
            index.propFamilies[familyId]?.props.unshift(prop)
          }
        }
      }
    }

    if (contents.textures) {
      for (const textureId of contents.textures) {
        index.textures[textureId] ??= []
        index.textures[textureId].unshift(file)
      }
    }
  })

  return index
}
