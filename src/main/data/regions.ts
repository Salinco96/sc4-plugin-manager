import path from "node:path"

import { size } from "@salinco/nice-utils"
import { parse as parseINI } from "ini"

import type { CityID, RegionID, RegionInfo, Regions } from "@common/regions"
import { fsQueryFiles, fsRead, getFileVersion } from "@node/files"
import type { TaskContext } from "@node/tasks"

export async function loadRegions(
  context: TaskContext,
  regionsPath: string,
  backupsPath: string,
): Promise<Regions> {
  try {
    const configPaths = await fsQueryFiles(regionsPath, "*/region.ini")

    const regions: Regions = {}

    for (const configPath of configPaths) {
      const regionId = configPath.split("/")[0] as RegionID

      const regionConfig = parseINI(await fsRead(path.resolve(regionsPath, configPath)))
      const regionPath = path.resolve(regionsPath, regionId)

      const regionName: string | undefined = regionConfig["Regional Settings"]?.Name

      const region: RegionInfo = {
        cities: {},
        id: regionId,
        name: regionName && !regionName.startsWith("#") ? regionName : regionId,
      }

      const cityFiles = await fsQueryFiles(regionPath, "City - *.sc4")

      for (const cityFile of cityFiles) {
        const cityId = cityFile.match(/City - (.+)[.]sc4/i)?.[1] as CityID

        region.cities[cityId] = {
          backups: [],
          established: !cityId.startsWith("New City"),
          id: cityId,
          name: cityId,
          version: await getFileVersion(path.resolve(regionPath, cityFile)),
        }

        const backupPath = path.resolve(backupsPath, regionId, cityId)
        const backupFiles = await fsQueryFiles(backupPath, "*.sc4")

        for (const backupFile of backupFiles) {
          const match = backupFile.match(
            /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})(?:-(.*))?[.]sc4/i,
          )

          const version = await getFileVersion(path.resolve(backupPath, backupFile))

          region.cities[cityId].backups.push({
            description: match?.[7] ?? undefined,
            file: backupFile,
            time: match
              ? new Date(
                  Number.parseInt(match[1], 10),
                  Number.parseInt(match[2], 10) - 1,
                  Number.parseInt(match[3], 10),
                  Number.parseInt(match[4], 10),
                  Number.parseInt(match[5], 10),
                  Number.parseInt(match[6], 10),
                )
              : new Date(version),
            version,
          })
        }
      }

      regions[regionId] = region
    }

    context.debug(`Loaded ${size(regions)} regions`)
    return regions
  } catch (error) {
    context.error("Failed to load regions", error)
    return {}
  }
}

export function getBackupFileName(time: Date, description?: string): string {
  const parts = [
    String(time.getFullYear()).padStart(4, "0"),
    String(time.getMonth() + 1).padStart(2, "0"),
    String(time.getDate()).padStart(2, "0"),
    String(time.getHours()).padStart(2, "0"),
    String(time.getMinutes()).padStart(2, "0"),
    String(time.getSeconds()).padStart(2, "0"),
  ]

  if (description) {
    parts.push(description)
  }

  return `${parts.join("-")}.sc4`
}
