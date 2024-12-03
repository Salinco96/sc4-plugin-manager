import path from "node:path"

import { CategoryID } from "@common/categories"
import { DBPFDataType, DBPFFileType, TGI, isDBPF, parseTGI } from "@common/dbpf"
import {
  ExemplarPropertyID,
  type ExemplarPropertyInfo,
  ExemplarType,
  getExemplarType,
} from "@common/exemplars"
import { Feature } from "@common/types"
import { parseStringArray } from "@common/utils/types"
import type { ContentsData } from "@common/variants"
import { loadDBPF } from "@node/dbpf"
import { getBuildingData } from "@node/dbpf/buildings"
import { getLotData } from "@node/dbpf/lots"
import { getPropData } from "@node/dbpf/props"
import { DeveloperID, type Exemplar, SimulatorID } from "@node/dbpf/types"
import { get, getBaseTextureId, getString } from "@node/dbpf/utils"
import { FileOpenMode, getExtension, openFile } from "@node/files"
import { collect, toArray, toHex, values } from "@salinco/nice-utils"

export interface SC4FileData extends ContentsData {
  categories: CategoryID[]
  features: Feature[]
}

export async function analyzeSC4Files(
  basePath: string,
  filePaths: string[],
  exemplarProperties: { [id in number]?: ExemplarPropertyInfo },
): Promise<SC4FileData> {
  const categories = new Set<CategoryID>()
  const features = new Set<Feature>()
  const contents: ContentsData = {}

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
                  if (familyId !== undefined && instanceId === getFamilyInstanceId(familyId)) {
                    contents.buildingFamilies ??= {}
                    contents.buildingFamilies[filePath] ??= {}
                    contents.buildingFamilies[filePath][toHex(familyId, 8)] = {
                      name: getString(exemplar, ExemplarPropertyID.ExemplarName),
                    }
                  }
                } else {
                  contents.buildings ??= {}
                  contents.buildings[filePath] ??= {}
                  contents.buildings[filePath][toHex(instanceId, 8)] = getBuildingData(exemplar)
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
                  const lot = getLotData(exemplar)
                  contents.lots ??= {}
                  contents.lots[filePath] ??= {}
                  contents.lots[filePath][toHex(instanceId, 8)] = lot

                  if (lot.requirements?.cam) {
                    categories.add(CategoryID.CAM)
                  }
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
                  if (familyId !== undefined && instanceId === getFamilyInstanceId(familyId)) {
                    contents.propFamilies ??= {}
                    contents.propFamilies[filePath] ??= {}
                    contents.propFamilies[filePath][toHex(familyId, 8)] = {
                      name: getString(exemplar, ExemplarPropertyID.ExemplarName),
                    }
                  }
                } else {
                  contents.props ??= {}
                  contents.props[filePath] ??= {}
                  contents.props[filePath][toHex(instanceId, 8)] = getPropData(exemplar)
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
              const textureId = getBaseTextureId(instanceId)
              if (!contents.textures?.[filePath]?.includes(textureId)) {
                contents.textures ??= {}
                contents.textures[filePath] ??= []
                contents.textures[filePath].push(textureId)
              }
            }
            break
          }

          case DBPFDataType.S3D: {
            const [t, g, i] = parseTGI(entry.id)
            const modelId = TGI(t, g, i & 0xffff0000) // Ignore zoom/rotation
            if (!contents.models?.[filePath]?.includes(modelId)) {
              contents.models ??= {}
              contents.models[filePath] ??= []
              contents.models[filePath].push(modelId)
            }
            break
          }
        }
      }
    }
  }

  const buildings = values(contents.buildings ?? {}).flatMap(buildings =>
    collect(buildings, ({ category }, id) => ({ category, id })),
  )

  const lots = values(contents.lots ?? {}).flatMap(values)

  for (const building of buildings) {
    if (building.category && lots.some(lot => lot.building === building.id)) {
      for (const category of parseStringArray(building.category)) {
        categories.add(category as CategoryID)
      }
    }
  }

  return {
    ...contents,
    categories: toArray(categories),
    features: toArray(features),
  }
}

export function getFamilyInstanceId(familyId: number): number {
  return (familyId + 0x10000000) & 0xffffffff
}
