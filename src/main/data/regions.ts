import path from "node:path"

import { size } from "@salinco/nice-utils"
import { glob } from "glob"
import { parse as parseINI } from "ini"

import type { RegionID, RegionInfo, Regions } from "@common/regions"
import { readFile } from "@node/files"
import type { TaskContext } from "@node/tasks"

export async function loadRegions(context: TaskContext, basePath: string): Promise<Regions> {
  try {
    const configPaths = await glob("*/region.ini", {
      cwd: basePath,
      nodir: true,
      posix: true,
    })

    const regions: Regions = {}

    for (const configPath of configPaths) {
      const regionId = configPath.split("/")[0] as RegionID

      const regionConfig = parseINI(await readFile(path.join(basePath, configPath)))
      const regionPath = path.join(basePath, regionId)

      const region: RegionInfo = {
        cities: {},
        id: regionId,
        name: regionConfig["Regional Settings"]?.Name ?? regionId,
      }

      const cityPaths = await glob("City - *.sc4", {
        cwd: regionPath,
        nodir: true,
      })

      for (const cityPath of cityPaths) {
        const cityName = cityPath.match(/City - (.+)[.]sc4/i)?.[1]

        if (cityName) {
          region.cities[cityName] = {
            established: !cityName.startsWith("New City"),
            name: cityName,
          }
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
