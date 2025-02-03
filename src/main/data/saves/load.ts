import { toHex } from "@salinco/nice-utils"

import type { BuildingID } from "@common/buildings"
import type { LotID } from "@common/lots"
import type { SaveInfo } from "@common/regions"
import { FileOpenMode, fsOpen } from "@node/files"
import type { TaskContext } from "@node/tasks"

import { SaveFile } from "./subfiles/SaveFile"

export async function loadSaveInfo(context: TaskContext, fullPath: string): Promise<SaveInfo> {
  const info = await fsOpen(fullPath, FileOpenMode.READ, async file => {
    context.debug(`Loading ${fullPath}...`)

    const save = await SaveFile.fromFile(file)

    const buildings = await save.buildings()
    const buildingIds = new Set<BuildingID>()
    if (buildings) {
      for (const building of buildings.data) {
        if (building.buildingId) {
          buildingIds.add(toHex(building.buildingId, 8) as BuildingID)
        }
      }
    }

    const lots = await save.lots()
    const lotIds = new Set<LotID>()
    if (lots) {
      for (const lot of lots.data) {
        if (lot.lotId) {
          lotIds.add(toHex(lot.lotId, 8) as LotID)
        }
      }
    }

    return {
      buildings: Array.from(buildingIds),
      lots: Array.from(lotIds),
    }
  })

  return info
}
