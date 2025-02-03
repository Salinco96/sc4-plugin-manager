import path from "node:path"

import { parseHex, toHex } from "@salinco/nice-utils"

import { TGI, parseTGI } from "@common/dbpf"
import type { LotID, LotInfo, ZoneDensity } from "@common/lots"
import type { RCIType } from "@common/lots"
import { ZoneType } from "@node/dbpf/types"
import { FileOpenMode, fsCreate, fsMove, fsOpen, fsRemove } from "@node/files"
import type { TaskContext } from "@node/tasks"

import { RCITypeToZoneType, ZoneTypeToRCIType } from "./constants"
import { SaveFile } from "./subfiles/SaveFile"
import { SimGrid, SimGridDataID } from "./subfiles/SimGrid"

async function updateSaveFile(
  context: TaskContext,
  fullPath: string,
  options: {
    handler: (context: TaskContext, save: SaveFile) => Promise<void>
    tempPath: string
  },
): Promise<boolean> {
  try {
    const updated = await fsOpen(fullPath, FileOpenMode.READ, async file => {
      const save = await SaveFile.fromFile(file)

      await options.handler(context, save)

      if (!save.isDirty()) {
        return false
      }

      await fsCreate(path.dirname(options.tempPath))
      await save.write(options.tempPath)

      return true
    })

    if (updated) {
      // Sanity check - can we read the modified file back?
      await fsOpen(options.tempPath, FileOpenMode.READ, async tempFile => {
        const save = await SaveFile.fromFile(tempFile)
        await save.lots()
      })

      await fsMove(options.tempPath, fullPath, { overwrite: true })
    }

    return updated
  } finally {
    await fsRemove(options.tempPath)
  }
}

export async function fixSave(
  context: TaskContext,
  fullPath: string,
  options: {
    tempPath: string
  },
): Promise<boolean> {
  return updateSaveFile(context, fullPath, {
    tempPath: options.tempPath,
    handler: async (context, save) => {
      context.debug(`Fixing issues in ${fullPath}...`, options)

      const lots = await save.lots()
      const zoneTypes = await save.grid(SimGridDataID.ZoneTypes)

      if (!lots) {
        throw Error("Unable to locate lots")
      }

      if (!zoneTypes) {
        throw Error("Unable to locate the zone type SimGrid")
      }

      // 1 - Regenerate Zone SimGrid

      // Mutate a copy of the zone SimGrid
      const zoneTypesCopy = new SimGrid(zoneTypes)
      for (let x = 0; x <= zoneTypes.size; x++) {
        for (let z = 0; z <= zoneTypes.size; z++) {
          const zoneType = zoneTypes.get(x, z)
          // Unset all zones, except landfills
          zoneTypesCopy.set(x, z, zoneType === ZoneType.Landfill ? zoneType : ZoneType.None)
        }
      }

      // Fill the copy according to lots
      for (const lot of lots.data) {
        for (let x = lot.minX; x <= lot.maxX; x++) {
          for (let z = lot.minZ; z <= lot.maxZ; z++) {
            zoneTypesCopy.set(x, z, lot.zoneType)
          }
        }
      }

      // Copy changes back
      for (let x = 0; x <= zoneTypes.size; x++) {
        for (let z = 0; z <= zoneTypes.size; z++) {
          const zoneType = zoneTypesCopy.get(x, z)
          if (zoneTypes.get(x, z) !== zoneType) {
            zoneTypes.set(x, z, zoneType)
            zoneTypes.dirty()
          }
        }
      }
    },
  })
}

export async function growify(
  context: TaskContext,
  fullPath: string,
  options: {
    density: ZoneDensity
    historical: boolean
    rciTypes: RCIType[]
    tempPath: string
  },
): Promise<boolean> {
  return updateSaveFile(context, fullPath, {
    tempPath: options.tempPath,
    handler: async (context, save) => {
      context.debug(`Growifying lots in ${fullPath}...`, options)

      const lots = await save.lots()
      const zoneTypes = await save.grid(SimGridDataID.ZoneTypes)

      if (!lots) {
        throw Error("Unable to locate lots")
      }

      if (!zoneTypes) {
        throw Error("Unable to locate the zone type SimGrid")
      }

      for (const lot of lots.data) {
        const rciType = options.rciTypes.find(type => lot.isGrowifyable(type))

        if (rciType) {
          lot.zoneType = RCITypeToZoneType[rciType][options.density]
          lot.dirty()

          if (options.historical) {
            lot.makeHistorical()
          }

          for (let x = lot.minX; x <= lot.maxX; x++) {
            for (let z = lot.minZ; z <= lot.maxZ; z++) {
              zoneTypes.set(x, z, lot.zoneType)
            }
          }

          zoneTypes.dirty()
        }
      }
    },
  })
}

export async function makeHistorical(
  context: TaskContext,
  fullPath: string,
  options: {
    rciTypes: RCIType[]
    tempPath: string
  },
): Promise<boolean> {
  return updateSaveFile(context, fullPath, {
    tempPath: options.tempPath,
    handler: async (context, save) => {
      context.debug(`Marking lots as historical in ${fullPath}...`, options)

      const lots = await save.lots()

      if (!lots) {
        throw Error("Unable to locate lots")
      }

      for (const lot of lots.data) {
        const rciType = ZoneTypeToRCIType[lot.zoneType]
        if (rciType && options.rciTypes.includes(rciType)) {
          lot.makeHistorical()
        }
      }
    },
  })
}

/**
 * TODO: THIS DOES NOT SUPPORT LOTS USING BUILDING FAMILIES!!!
 */
export async function updateLots(
  context: TaskContext,
  fullPath: string,
  options: {
    removeLots?: LotID[]
    replaceLots?: { [id in LotID]?: LotInfo }
    tempPath: string
  },
): Promise<boolean> {
  return updateSaveFile(context, fullPath, {
    tempPath: options.tempPath,
    handler: async (context, save) => {
      context.debug(`Updating ${fullPath}...`, options)

      const buildings = await save.buildings()

      if (!buildings) {
        throw Error("Unable to locate buildings")
      }

      const lots = await save.lots()

      if (!lots) {
        throw Error("Unable to locate lots")
      }

      for (const lot of lots.data) {
        if (lot.lotId && lot.buildingId) {
          const id = toHex(lot.lotId, 8) as LotID
          if (options.removeLots?.includes(id)) {
            // TODO: Removing lot is not implemented
            context.warn("Removing lots is not yet implemented!")
          } else if (options.replaceLots?.[id]) {
            const newLotInfo = options.replaceLots[id]
            const newBuildingId = newLotInfo.building ? parseHex(newLotInfo.building) : null

            if (newBuildingId && newBuildingId !== lot.buildingId) {
              const minX = lot.minX * 16
              const maxX = (lot.maxX + 1) * 16
              const minZ = lot.minZ * 16
              const maxZ = (lot.maxZ + 1) * 16

              // There is no direct reference to building, we just look by ID and overlapping coordinates
              const building = buildings.data.find(
                building =>
                  building.buildingId === lot.buildingId &&
                  building.minX < maxX &&
                  building.maxX > minX &&
                  building.minZ < maxZ &&
                  building.maxZ > minZ,
              )

              if (!building) {
                throw Error(
                  `Unable to find building with ID ${toHex(lot.buildingId, 8)} for lot ${id} (${minX} - ${maxX} ; ${minZ} - ${maxZ})`,
                )
              }

              // TODO: What happens if group ID is actually different???
              const [typeId, groupId] = parseTGI(building.tgi)
              building.tgi = TGI(typeId, groupId, newBuildingId)
              building.buildingId = newBuildingId
              building.dirty()

              lot.buildingId = newBuildingId
            }

            // TODO: In some cases we may need to change other stats, e.g. wealth, jobs, budgets...
            // TODO: For now we assume that replace functionality is only used for strictly-equivalent lot (e.g. HD/SD, Maxis/Dark Nite)
            lot.lotId = parseHex(newLotInfo.id)
            lot.dirty()
          }
        }
      }
    },
  })
}
