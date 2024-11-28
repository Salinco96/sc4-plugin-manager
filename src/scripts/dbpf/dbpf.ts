import path from "node:path"

import { values } from "@salinco/nice-utils"

import type { BuildingData } from "@common/buildings"
import { DBPFDataType, DBPFFileType, TGI, isDBPF, parseTGI } from "@common/dbpf"
import { type ExemplarPropertyInfo, ExemplarType, getExemplarType } from "@common/exemplars"
import type { LotData } from "@common/lots"
import { Feature } from "@common/types"
import { loadDBPF } from "@node/dbpf"
import { FileOpenMode, getExtension, openFile } from "@node/files"

import { CategoryID } from "@common/categories"
import { parseStringArray } from "@common/utils/types"
import { getBuildingData } from "./buildings"
import { getLotData } from "./lots"
import { DeveloperID, type Exemplar, SimulatorID } from "./types"
import { getBaseTextureId } from "./utils"

export interface SC4FileData {
  buildings: BuildingData[]
  categories: CategoryID[]
  features: Feature[]
  lots: LotData[]
  models: string[]
  props: string[]
  textures: string[]
}

export async function analyzeSC4Files(
  basePath: string,
  filePaths: string[],
  exemplarProperties: { [id in number]?: ExemplarPropertyInfo },
): Promise<SC4FileData> {
  const buildings: BuildingData[] = []
  const categories = new Set<CategoryID>()
  const features = new Set<Feature>()
  const lots: LotData[] = []
  const models = new Set<string>()
  const props = new Set<string>()
  const textures = new Set<string>()

  for (const filePath of filePaths) {
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

            switch (exemplarType) {
              case ExemplarType.Building: {
                buildings.push(getBuildingData(exemplar))
                break
              }

              case ExemplarType.Developer: {
                categories.add(CategoryID.GAMEPLAY)
                const type = DeveloperID[instanceId] as keyof typeof DeveloperID

                if (type) {
                  const feature = Feature[`DEVELOPER_${type}`]
                  features.add(feature)
                }

                break
              }

              case ExemplarType.Lighting: {
                categories.add(CategoryID.GRAPHICS)
                features.add(Feature.DARKNITE) // TODO: Anything else?
                break
              }

              case ExemplarType.LotConfig: {
                lots.push(getLotData(exemplar))
                break
              }

              case ExemplarType.Ordinance: {
                categories.add(CategoryID.ORDINANCES)
                break
              }

              case ExemplarType.Prop: {
                props.add(exemplar.id)
                break
              }

              case ExemplarType.Simulator: {
                categories.add(CategoryID.GAMEPLAY)
                const type = SimulatorID[instanceId] as keyof typeof SimulatorID

                if (type) {
                  const feature = Feature[`SIMULATOR_${type}`]
                  features.add(feature)
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
    buildings,
    categories: Array.from(categories),
    features: Array.from(features),
    lots,
    models: Array.from(models),
    props: Array.from(props),
    textures: Array.from(textures),
  }
}
