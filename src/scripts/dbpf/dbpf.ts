import path from "node:path"

import { toHex, values } from "@salinco/nice-utils"

import type { BuildingData, BuildingFamilyData } from "@common/buildings"
import { CategoryID } from "@common/categories"
import { DBPFDataType, DBPFFileType, TGI, isDBPF, parseTGI } from "@common/dbpf"
import {
  ExemplarPropertyID,
  type ExemplarPropertyInfo,
  ExemplarType,
  getExemplarType,
} from "@common/exemplars"
import type { LotData } from "@common/lots"
import type { PropData, PropFamilyData } from "@common/props"
import { Feature } from "@common/types"
import { parseStringArray } from "@common/utils/types"
import { loadDBPF } from "@node/dbpf"
import { getBuildingData } from "@node/dbpf/buildings"
import { getLotData } from "@node/dbpf/lots"
import { getPropData } from "@node/dbpf/props"
import { DeveloperID, type Exemplar, SimulatorID } from "@node/dbpf/types"
import { get, getBaseTextureId, getString } from "@node/dbpf/utils"
import { FileOpenMode, getExtension, openFile } from "@node/files"

export interface SC4FileData {
  buildingFamilies: BuildingFamilyData[]
  buildings: BuildingData[]
  categories: CategoryID[]
  features: Feature[]
  lots: LotData[]
  models: string[]
  propFamilies: PropFamilyData[]
  props: PropData[]
  textures: string[]
}

export async function analyzeSC4Files(
  basePath: string,
  filePaths: string[],
  exemplarProperties: { [id in number]?: ExemplarPropertyInfo },
): Promise<SC4FileData> {
  const buildingFamilies: BuildingFamilyData[] = []
  const buildings: BuildingData[] = []
  const categories = new Set<CategoryID>()
  const features = new Set<Feature>()
  const lots: LotData[] = []
  const models = new Set<string>()
  const propFamilies: PropFamilyData[] = []
  const props: PropData[] = []
  const textures = new Set<string>()

  for (const filePath of filePaths) {
    console.debug(`Analyzing ${filePath}...`)

    if (getExtension(filePath) === ".dll") {
      categories.add(CategoryID.MODS)
      categories.add(CategoryID.DLL)
    }

    if (isDBPF(filePath)) {
      const file = await openFile(path.join(basePath, filePath), FileOpenMode.READ, file => {
        return loadDBPF(file, { exemplarProperties, loadExemplars: true })
      })

      for (const entry of values(file.entries)) {
        switch (entry.type) {
          case DBPFDataType.EXMP: {
            const instanceId = parseTGI(entry.id)[2]
            const exemplar = { ...entry, file: filePath } as Exemplar
            const exemplarType = getExemplarType(entry.id, entry.data)
            const isCohort = !!entry.data?.isCohort

            switch (exemplarType) {
              case ExemplarType.Building: {
                if (isCohort) {
                  const familyId = get(exemplar, ExemplarPropertyID.PropFamily)
                  if (familyId !== undefined && instanceId === getPropFamilyInstanceId(familyId)) {
                    buildingFamilies.push({
                      file: filePath,
                      id: toHex(familyId, 8),
                      name: getString(exemplar, ExemplarPropertyID.ExemplarName),
                    })
                  }
                } else {
                  buildings.push(getBuildingData(exemplar))
                }

                break
              }

              case ExemplarType.Developer: {
                categories.add(CategoryID.GAMEPLAY)

                if (!isCohort) {
                  const type = DeveloperID[instanceId] as keyof typeof DeveloperID
                  if (type) {
                    const feature = Feature[`DEVELOPER_${type}`]
                    features.add(feature)
                  }
                }

                break
              }

              case ExemplarType.Lighting: {
                categories.add(CategoryID.GRAPHICS)
                features.add(Feature.DARKNITE)
                break
              }

              case ExemplarType.LotConfig: {
                if (!isCohort) {
                  lots.push(getLotData(exemplar))
                }

                break
              }

              case ExemplarType.Ordinance: {
                categories.add(CategoryID.ORDINANCES)
                break
              }

              case ExemplarType.Prop: {
                if (isCohort) {
                  const familyId = get(exemplar, ExemplarPropertyID.PropFamily)
                  if (familyId !== undefined && instanceId === getPropFamilyInstanceId(familyId)) {
                    propFamilies.push({
                      file: filePath,
                      id: toHex(familyId, 8),
                      name: getString(exemplar, ExemplarPropertyID.ExemplarName),
                    })
                  }
                } else {
                  props.push(getPropData(exemplar))
                }

                break
              }

              case ExemplarType.Simulator: {
                categories.add(CategoryID.GAMEPLAY)

                if (!isCohort) {
                  const type = SimulatorID[instanceId] as keyof typeof SimulatorID
                  if (type) {
                    const feature = Feature[`SIMULATOR_${type}`]
                    features.add(feature)
                  }
                }

                break
              }
            }

            break
          }

          case DBPFDataType.FSH: {
            if (entry.id.startsWith(DBPFFileType.FSH_TEXTURE)) {
              const instanceId = parseTGI(entry.id)[2]
              textures.add(getBaseTextureId(instanceId))
            }
            break
          }

          case DBPFDataType.S3D: {
            const [t, g, i] = parseTGI(entry.id)
            const modelId = TGI(t, g, i & 0xffff0000) // Ignore zoom/rotation
            models.add(modelId)
            break
          }
        }
      }
    }
  }

  for (const building of buildings) {
    if (building.category && lots.some(lot => lot.building === building.id)) {
      for (const category of parseStringArray(building.category)) {
        categories.add(category as CategoryID)
      }
    }
  }

  for (const lot of lots) {
    if (lot.requirements?.cam) {
      categories.add(CategoryID.CAM)
    }
  }

  return {
    buildingFamilies,
    buildings,
    categories: Array.from(categories),
    features: Array.from(features),
    lots,
    models: Array.from(models),
    propFamilies,
    props,
    textures: Array.from(textures),
  }
}

export function getPropFamilyInstanceId(familyId: number): number {
  return (familyId + 0x10000000) & 0xffffffff
}
