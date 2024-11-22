import fs from "node:fs/promises"
import path from "node:path"

import { parseHex, size } from "@salinco/nice-utils"

import { type AuthorData, type AuthorID, type Authors, loadAuthorInfo } from "@common/authors"
import type { Categories } from "@common/categories"
import {
  type ExemplarPropertyData,
  type ExemplarPropertyInfo,
  ExemplarValueType,
} from "@common/exemplars"
import type { OptionInfo } from "@common/options"
import type { ProfileData, ProfileID, Profiles } from "@common/profiles"
import { ConfigFormat } from "@common/types"
import { forEach, mapValues } from "@common/utils/objects"
import { isEnum } from "@common/utils/types"
import { loadConfig, readConfig } from "@node/configs"
import { DIRNAMES, FILENAMES, TEMPLATE_PREFIX } from "@utils/constants"
import type { TaskContext } from "@utils/tasks"

import { fromProfileData } from "./profiles"

export async function loadAuthors(context: TaskContext, basePath: string): Promise<Authors> {
  try {
    const config = await loadConfig<{ [authorId in AuthorID]?: AuthorData }>(
      basePath,
      FILENAMES.dbAuthors,
    )

    if (!config) {
      throw Error(`Missing config ${FILENAMES.dbAuthors}`)
    }

    const authors = mapValues(config.data, (data, id) => loadAuthorInfo(id, data))

    context.debug(`Loaded ${size(authors)} authors`)
    return authors
  } catch (error) {
    context.error("Failed to load authors", error)
    return {}
  }
}

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

export async function loadProfileOptions(
  context: TaskContext,
  basePath: string,
): Promise<OptionInfo[]> {
  try {
    const config = await loadConfig<{ options: OptionInfo[] }>(basePath, FILENAMES.dbProfileOptions)

    if (!config) {
      throw Error(`Missing config ${FILENAMES.dbProfileOptions}`)
    }

    const options = config.data.options

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
