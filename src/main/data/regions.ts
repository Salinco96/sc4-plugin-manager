import path from "node:path"

import { mapDefined, size } from "@salinco/nice-utils"
import { glob } from "glob"
import { parse as parseINI } from "ini"

import type { CityBackupInfo, CityID, RegionID, RegionInfo, Regions } from "@common/regions"
import { readFile } from "@node/files"
import type { TaskContext } from "@node/tasks"

export async function loadRegions(
  context: TaskContext,
  regionsPath: string,
  backupsPath: string,
): Promise<Regions> {
  try {
    const configPaths = await glob("*/region.ini", {
      cwd: regionsPath,
      nodir: true,
      posix: true,
    })

    const regions: Regions = {}

    for (const configPath of configPaths) {
      const regionId = configPath.split("/")[0] as RegionID

      const regionConfig = parseINI(await readFile(path.join(regionsPath, configPath)))
      const regionPath = path.join(regionsPath, regionId)

      const region: RegionInfo = {
        cities: {},
        id: regionId,
        name: regionConfig["Regional Settings"]?.Name ?? regionId,
      }

      const cityFiles = await glob("City - *.sc4", {
        cwd: regionPath,
        nodir: true,
        withFileTypes: true,
      })

      for (const cityFile of cityFiles) {
        const cityId = cityFile.relative().match(/City - (.+)[.]sc4/i)?.[1] as CityID
        const backupPath = path.join(backupsPath, regionId, cityId)
        const backupFiles = await glob("*.sc4", {
          cwd: backupPath,
          nodir: true,
          withFileTypes: true,
        })

        region.cities[cityId] = {
          backups: mapDefined(backupFiles, file =>
            parseBackupInfo(file.relative(), file.mtime, cityFile.mtime),
          ),
          established: !cityId.startsWith("New City"),
          id: cityId,
          name: cityId,
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

function parseBackupInfo(
  fileName: string,
  backupTime?: Date,
  cityTime?: Date,
): CityBackupInfo | undefined {
  const match = fileName.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})(?:-(.*))?[.]sc4/i)
  if (!match) {
    return
  }

  const [, year, month, date, hour, minute, second, description] = match

  const time =
    backupTime ??
    new Date(
      Number.parseInt(year, 10),
      Number.parseInt(month, 10) - 1,
      Number.parseInt(date, 10),
      Number.parseInt(hour, 10),
      Number.parseInt(minute, 10),
      Number.parseInt(second, 10),
    )

  return {
    current: backupTime === cityTime,
    description,
    file: fileName,
    time,
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
