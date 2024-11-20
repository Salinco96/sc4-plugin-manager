import path from "node:path"

import { DBPFDataType, DBPFFileType, TGI, isDBPF, parseTGI } from "@common/dbpf"
import type { ExemplarPropertyInfo } from "@common/exemplars"
import { type BuildingData, Feature, type LotData } from "@common/types"
import { values } from "@common/utils/objects"
import { loadDBPF } from "@node/dbpf"
import { FileOpenMode, openFile } from "@node/files"

import { getBuildingData } from "./buildings"
import { getLotData } from "./lots"
import { DeveloperID, type Exemplar, ExemplarPropertyID, ExemplarType, SimulatorID } from "./types"
import { get, getBaseTextureId } from "./utils"

export interface SC4FileData {
  buildings: BuildingData[]
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
  const exemplars: { [id in TGI]?: Exemplar } = {}

  const buildings: { [id: string]: BuildingData } = {}
  const features = new Set<Feature>()
  const lots: { [id: string]: LotData } = {}
  const models = new Set<string>()
  const props = new Set<string>()
  const textures = new Set<string>()

  for (const filePath of filePaths) {
    if (isDBPF(filePath)) {
      const file = await openFile(path.join(basePath, filePath), FileOpenMode.READ, file => {
        return loadDBPF(file, { exemplarProperties, loadExemplars: true })
      })

      for (const entry of values(file.entries)) {
        switch (entry.type) {
          case DBPFDataType.EXMP: {
            exemplars[entry.id] = { ...entry, file: filePath } as Exemplar
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

  for (const exemplar of values(exemplars)) {
    const instanceId = parseTGI(exemplar.id)[2]

    switch (get(exemplar, ExemplarPropertyID.ExemplarType)) {
      case ExemplarType.Building: {
        const buildingData = getBuildingData(exemplar)

        // TODO: Handle lot defined multiple times, e.g. DN and MN in same download
        if (buildings[buildingData.id]) {
          console.warn(
            `Building ${buildingData.label} (${buildingData.id}) is also defined in ${buildings[buildingData.id].filename}`,
          )
        }

        buildings[buildingData.id] = buildingData
        break
      }

      case ExemplarType.Developer: {
        const type = DeveloperID[instanceId] as keyof typeof DeveloperID

        if (type) {
          const feature = Feature[`DEVELOPER_${type}`]
          features.add(feature)
        }

        break
      }

      case ExemplarType.Lighting: {
        features.add(Feature.DARKNITE) // TODO: Anything else?
        break
      }

      case ExemplarType.LotConfig: {
        const lotData = getLotData(exemplar)

        // TODO: Handle lot defined multiple times, e.g. DN and MN in same download
        if (lots[lotData.id]) {
          console.warn(
            `Lot ${lotData.name} (${lotData.id}) is also defined in ${lots[lotData.id].filename}`,
          )
        }

        lots[lotData.id] = lotData
        break
      }

      case ExemplarType.Prop: {
        props.add(exemplar.id)
        break
      }

      case ExemplarType.Simulator: {
        const type = SimulatorID[instanceId] as keyof typeof SimulatorID

        if (type) {
          const feature = Feature[`SIMULATOR_${type}`]
          features.add(feature)
        }

        break
      }
    }
  }

  return {
    buildings: values(buildings),
    features: Array.from(features),
    lots: values(lots),
    models: Array.from(models),
    props: Array.from(props),
    textures: Array.from(textures),
  }
}
