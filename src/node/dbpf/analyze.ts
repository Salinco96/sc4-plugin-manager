import path from "node:path"

import {
  DBPFDataType,
  DBPFFileType,
  type GroupID,
  getTextureIdRange,
  isDBPF,
  parseTGI,
} from "@common/dbpf"
import {
  type ExemplarProperties,
  ExemplarPropertyID,
  ExemplarType,
  getExemplarType,
} from "@common/exemplars"
import type { FamilyID } from "@common/families"
import type { FloraInfo } from "@common/mmps"
import { Feature } from "@common/types"
import type { Contents, FileContentsInfo } from "@common/variants"
import { loadDBPF } from "@node/dbpf"
import { getBuildingInfo } from "@node/dbpf/buildings"
import { getLotInfo } from "@node/dbpf/lots"
import { getFloraInfo } from "@node/dbpf/mmps"
import { getPropInfo } from "@node/dbpf/props"
import { DeveloperID, type Exemplar, SimulatorID } from "@node/dbpf/types"
import { get, getFamilyInstanceId, getModelId, getString } from "@node/dbpf/utils"
import { FileOpenMode, openFile } from "@node/files"
import { toArray, toHex, values } from "@salinco/nice-utils"

export async function analyzeSC4Files(
  basePath: string,
  filePaths: string[],
  exemplarProperties: ExemplarProperties,
): Promise<{ contents: Contents; features: Feature[] }> {
  const features = new Set<Feature>()
  const contents: Contents = {}

  for (const filePath of filePaths) {
    const results = await analyzeSC4File(basePath, filePath, exemplarProperties)

    contents[filePath] = results.contents
    for (const feature of results.features) {
      features.add(feature)
    }
  }

  return { contents, features: toArray(features) }
}

export async function analyzeSC4File(
  basePath: string,
  filePath: string,
  exemplarProperties: ExemplarProperties,
): Promise<{ contents: FileContentsInfo; features: Feature[] }> {
  const features = new Set<Feature>()
  const contents: FileContentsInfo = {}

  console.debug(`Analyzing ${filePath}...`)

  if (isDBPF(filePath)) {
    const file = await openFile(path.join(basePath, filePath), FileOpenMode.READ, file => {
      return loadDBPF(file, { exemplarProperties, loadExemplars: true })
    })

    const mmpChains: {
      [instanceId in number]?: {
        next?: number
        stages: FloraInfo[]
      }
    } = {}

    for (const entry of values(file.entries)) {
      switch (entry.type) {
        case DBPFDataType.EXMP: {
          const [, groupId, instanceId] = parseTGI(entry.id)
          const exemplar = { ...entry, file: filePath } as Exemplar
          const exemplarType = getExemplarType(entry.id, entry.data)
          const isCohort = !!entry.data?.isCohort

          switch (exemplarType) {
            case ExemplarType.Building: {
              if (isCohort) {
                const familyId = get(exemplar, ExemplarPropertyID.PropFamily)
                if (familyId && instanceId === getFamilyInstanceId(familyId)) {
                  contents.buildingFamilies ??= []
                  contents.buildingFamilies.push({
                    file: filePath,
                    group: toHex(groupId, 8) as GroupID,
                    id: toHex(familyId, 8) as FamilyID,
                    name: getString(exemplar, ExemplarPropertyID.ExemplarName),
                  })
                }
              } else {
                contents.buildings ??= []
                contents.buildings.push(getBuildingInfo(exemplar))
              }

              break
            }

            case ExemplarType.Developer: {
              if (!isCohort) {
                const type = DeveloperID[instanceId] as keyof typeof DeveloperID
                if (type) {
                  const feature = Feature[`DEVELOPER_${type}`]
                  features.add(feature)
                }
              }

              break
            }

            case ExemplarType.Flora: {
              if (!isCohort) {
                const chain: { next?: number; stages: FloraInfo[] } = {
                  next: get(exemplar, ExemplarPropertyID.FloraClusterType),
                  stages: [getFloraInfo(exemplar, file)],
                }

                // Link to next stage
                if (chain.next !== undefined) {
                  const nextChain = mmpChains[chain.next]
                  if (nextChain) {
                    delete mmpChains[chain.next]
                    chain.next = nextChain.next
                    chain.stages.push(...nextChain.stages)
                  }
                }

                // Link to previous stage or start a new chain
                const previousChain = values(mmpChains).find(chain => chain.next === instanceId)
                if (previousChain) {
                  previousChain.next = chain.next
                  previousChain.stages.push(...chain.stages)
                } else {
                  mmpChains[instanceId] = chain
                }
              }

              break
            }

            case ExemplarType.Lighting: {
              features.add(Feature.DARKNITE)
              break
            }

            case ExemplarType.LotConfig: {
              if (!isCohort) {
                contents.lots ??= []
                contents.lots.push(getLotInfo(exemplar))
              }

              break
            }

            case ExemplarType.Ordinance: {
              // todo
              break
            }

            case ExemplarType.Prop: {
              if (isCohort) {
                const familyId = get(exemplar, ExemplarPropertyID.PropFamily)
                if (familyId !== undefined && instanceId === getFamilyInstanceId(familyId)) {
                  contents.propFamilies ??= []
                  contents.propFamilies.push({
                    file: filePath,
                    group: toHex(groupId, 8) as GroupID,
                    id: toHex(familyId, 8) as FamilyID,
                    name: getString(exemplar, ExemplarPropertyID.ExemplarName),
                  })
                }
              } else {
                contents.props ??= []
                contents.props.push(getPropInfo(exemplar))
              }

              break
            }

            case ExemplarType.Simulator: {
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
            const [textureId] = getTextureIdRange(instanceId)
            if (entry.id.endsWith(textureId)) {
              if (!contents.textures?.includes(textureId)) {
                contents.textures ??= []
                contents.textures.push(textureId)
              }
            }
          }

          break
        }

        case DBPFDataType.S3D: {
          const modelId = getModelId(entry.id)
          if (!contents.models?.includes(modelId)) {
            contents.models ??= []
            contents.models.push(modelId)
          }

          break
        }
      }
    }

    for (const chain of values(mmpChains)) {
      const [mmp, ...stages] = chain.stages
      contents.mmps ??= []
      contents.mmps.push({ ...mmp, stages: stages.length ? stages : undefined })
    }
  }

  return { contents, features: toArray(features) }
}
