import fs from "node:fs/promises"
import path from "node:path"

import { forEach, isEnum, mapDefined, mapValues, parseHex, size } from "@salinco/nice-utils"

import type { Categories } from "@common/categories"
import {
  type ExemplarProperties,
  type ExemplarPropertyData,
  type ExemplarPropertyInfo,
  ExemplarValueType,
} from "@common/exemplars"
import type { OptionInfo } from "@common/options"
import type { ProfileData, ProfileID, Profiles } from "@common/profiles"
import { ConfigFormat } from "@common/types"
import type { ContentsInfo } from "@common/variants"
import { loadConfig, readConfig } from "@node/configs"
import { type ContentsData, loadContentsInfo } from "@node/data/packages"
import { DIRNAMES, FILENAMES, TEMPLATE_PREFIX } from "@utils/constants"

import type { Assets } from "@common/assets"
import type { ToolID, Tools } from "@common/tools"
import { type OptionData, loadOptionInfo } from "@node/data/options"
import { type ToolData, loadToolInfo } from "@node/data/tools"
import { analyzeSC4Files } from "@node/dbpf/analyze"
import type { TaskContext } from "@node/tasks"
import { glob } from "glob"
import { fromProfileData } from "./profiles"

export async function loadCategories(context: TaskContext, basePath: string): Promise<Categories> {
  try {
    const config = await loadConfig<Categories>(basePath, FILENAMES.dbCategories)

    if (!config) {
      throw Error(`Missing config ${FILENAMES.dbCategories}`)
    }

    const categories = config.data

    context.debug(`Loaded ${size(categories)} categories`)
    return categories
  } catch (error) {
    context.error("Failed to load categories", error)
    return {}
  }
}

export async function loadExemplarProperties(
  context: TaskContext,
  basePath: string,
): Promise<Record<string, ExemplarPropertyInfo>> {
  try {
    const config = await loadConfig<Record<string, ExemplarPropertyData>>(
      basePath,
      FILENAMES.dbExemplarProperties,
    )

    if (!config) {
      throw Error(`Missing config ${FILENAMES.dbExemplarProperties}`)
    }

    const properties: Record<string, ExemplarPropertyInfo> = {}

    forEach(config.data, (data, propertyIdHex) => {
      const propertyInfo: ExemplarPropertyInfo = {
        ...data,
        type: data.type && ExemplarValueType[data.type],
      }

      if (propertyIdHex.includes("-")) {
        const [firstId, lastId] = propertyIdHex.split("-").map(parseHex)
        for (let propertyId = firstId; propertyId <= lastId; propertyId++) {
          properties[propertyId] = propertyInfo
        }
      } else {
        const propertyId = parseHex(propertyIdHex)
        properties[propertyId] = propertyInfo
      }
    })

    context.debug(`Loaded ${size(properties)} exemplar properties`)
    return properties
  } catch (error) {
    context.error("Failed to load exemplar properties", error)
    return {}
  }
}

export async function loadMaxisExemplars(
  context: TaskContext,
  basePath: string,
  categories: Categories,
): Promise<ContentsInfo> {
  try {
    const config = await loadConfig<ContentsData>(basePath, FILENAMES.dbMaxisExemplars)

    if (!config) {
      throw Error(`Missing config ${FILENAMES.dbMaxisExemplars}`)
    }

    return loadContentsInfo(config.data, categories)
  } catch (error) {
    context.error("Failed to load Maxis exemplars", error)
    return {}
  }
}

export async function loadExternals(
  context: TaskContext,
  basePath: string,
  exemplarProperties: ExemplarProperties,
): Promise<{ [path: string]: ContentsInfo }> {
  try {
    context.debug("Indexing external plugins...")

    const pluginFiles = await glob("**/*.{dat,sc4desc,sc4lot,sc4model}", {
      cwd: basePath,
      dot: true,
      nodir: true,
      withFileTypes: true,
    })

    const externals: { [path: string]: ContentsInfo } = {}

    for (const file of pluginFiles) {
      if (!file.isSymbolicLink()) {
        const relativePath = file.relativePosix()

        try {
          const { contents } = await analyzeSC4Files(basePath, [relativePath], exemplarProperties)

          externals[relativePath] = contents
        } catch (error) {
          context.error(`Failed to analyze ${relativePath}`, error)
        }
      }
    }

    return externals
  } catch (error) {
    context.error("Failed to index external plugins", error)
    return {}
  }
}

export async function loadProfileOptions(
  context: TaskContext,
  basePath: string,
): Promise<OptionInfo[]> {
  try {
    const config = await loadConfig<{ options: OptionData[] }>(basePath, FILENAMES.dbProfileOptions)

    if (!config) {
      throw Error(`Missing config ${FILENAMES.dbProfileOptions}`)
    }

    const options = mapDefined(config.data.options, loadOptionInfo)

    context.debug(`Loaded ${options.length} profile options`)
    return options
  } catch (error) {
    context.error("Failed to load profile options", error)
    return []
  }
}

export async function loadProfileTemplates(
  context: TaskContext,
  basePath: string,
): Promise<Profiles> {
  try {
    const templates: Profiles = {}

    const templatesPath = path.join(basePath, DIRNAMES.dbTemplates)
    const entries = await fs.readdir(templatesPath, { withFileTypes: true })
    for (const entry of entries) {
      const format = path.extname(entry.name)
      if (entry.isFile() && isEnum(format, ConfigFormat)) {
        const profileId = `${TEMPLATE_PREFIX}${path.basename(entry.name, format)}` as ProfileID
        const profilePath = path.join(templatesPath, entry.name)
        if (templates[profileId]) {
          context.error(`Duplicate profile template '${entry.name}'`)
          continue
        }

        try {
          const data = await readConfig<ProfileData>(profilePath)
          const profile = fromProfileData(profileId, data)
          profile.format = format
          templates[profileId] = profile
        } catch (error) {
          context.error(`Invalid profile template '${entry.name}'`, error)
        }
      }
    }

    context.debug(`Loaded ${size(templates)} profile templates`)

    return templates
  } catch (error) {
    context.error("Failed to load profile templates", error)
    return {}
  }
}

export async function loadTools(
  context: TaskContext,
  basePath: string,
  assets: Assets,
): Promise<Tools> {
  try {
    const config = await loadConfig<{ [toolId: ToolID]: ToolData }>(basePath, FILENAMES.dbTools)

    if (!config) {
      throw Error(`Missing config ${FILENAMES.dbTools}`)
    }

    const tools = mapValues(config.data, (data, id) => loadToolInfo(id, data, assets))

    context.debug(`Loaded ${size(tools)} tools`)
    return tools
  } catch (error) {
    context.error("Failed to load tools", error)
    return {}
  }
}
