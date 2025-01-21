import path from "node:path"

import { values } from "@salinco/nice-utils"

import type { ZoneDensity } from "@common/lots"
import { RCIType } from "@common/lots"
import { FileOpenMode, createIfMissing, moveTo, openFile, removeIfPresent } from "@node/files"
import type { TaskContext } from "@node/tasks"

import { RCITypeToZoneType, ZoneTypeToRCIType } from "./constants"
import { SaveFile } from "./subfiles/SaveFile"
import { SimGridDataID } from "./subfiles/SimGrid"

async function updateSaveFile(
  context: TaskContext,
  fullPath: string,
  options: {
    handler: (context: TaskContext, save: SaveFile) => Promise<void>
    tempPath: string
  },
): Promise<boolean> {
  try {
    const updated = await openFile(fullPath, FileOpenMode.READ, async file => {
      const save = new SaveFile(file)

      await options.handler(context, save)

      if (!save.isDirty()) {
        return false
      }

      await createIfMissing(path.dirname(options.tempPath))
      await openFile(options.tempPath, FileOpenMode.WRITE, async tempFile => {
        await save.write(tempFile)
      })

      return true
    })

    if (updated) {
      await moveTo(options.tempPath, fullPath)
    }

    return updated
  } finally {
    await removeIfPresent(options.tempPath)
  }
}

export async function growify(
  context: TaskContext,
  fullPath: string,
  options: {
    density: ZoneDensity
    makeHistorical: boolean
    rciTypes?: RCIType[]
    tempPath: string
  },
): Promise<boolean> {
  const rciTypes = options.rciTypes ?? values(RCIType)

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
        const rciType = rciTypes.find(type => lot.isGrowifyable(type))

        if (rciType) {
          lot.zoneType = RCITypeToZoneType[rciType][options.density]
          lot.dirty()

          if (options.makeHistorical) {
            lot.makeHistorical()
          }

          if (zoneTypes) {
            for (let x = lot.minX; x <= lot.maxX; x++) {
              for (let z = lot.minZ; z <= lot.maxZ; z++) {
                zoneTypes.set(x, z, lot.zoneType)
              }
            }

            zoneTypes.dirty()
          }
        }
      }
    },
  })
}

export async function makeHistorical(
  context: TaskContext,
  fullPath: string,
  options: {
    rciTypes?: RCIType[]
    tempPath: string
  },
): Promise<boolean> {
  const rciTypes = options.rciTypes ?? values(RCIType)

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
        if (rciType && rciTypes.includes(rciType)) {
          lot.makeHistorical()
        }
      }
    },
  })
}
