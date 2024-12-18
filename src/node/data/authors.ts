import { mapValues, size, toLowerCase } from "@salinco/nice-utils"

import type { AuthorID, Authors } from "@common/authors"
import { ConfigFormat } from "@common/types"
import { type MaybeArray, parseStringArray } from "@common/utils/types"
import { loadConfig, writeConfig } from "@node/configs"
import type { TaskContext } from "@node/tasks"

const CONFIG_NAME = "authors"

/** Raw author data */
export interface AuthorData {
  /** Other pseudos */
  alias?: MaybeArray<string>
  /** Author most-used pseudo (e.g. on Simtropolis) */
  name: string
  /** Teams */
  teams?: MaybeArray<string>
  /** Avatar thumbnail URL (e.g. on Simtropolis) */
  thumbnail?: string
  /** Author URL (e.g. on Simtropolis) */
  url?: string
}

export async function loadAuthors(context: TaskContext, basePath: string): Promise<Authors> {
  context.debug("Loading authors...")

  try {
    const config = await loadConfig<{ [authorId in AuthorID]?: AuthorData }>(basePath, CONFIG_NAME)

    if (!config) {
      throw Error(`Missing config ${CONFIG_NAME}`)
    }

    const authors = mapValues(config.data, (data, id) => {
      const alias = data.alias ? parseStringArray(data.alias) : undefined
      const teams = data.teams ? parseStringArray(data.teams).map(toLowerCase) : undefined

      return {
        ...data,
        alias,
        id,
        search: alias ? [data.name, ...alias].join("|") : undefined,
        teams: teams as AuthorID[] | undefined,
      }
    })

    context.debug(`Loaded ${size(authors)} authors`)
    return authors
  } catch (error) {
    context.error("Failed to load authors", error)
    return {}
  }
}

export async function writeAuthors(
  context: TaskContext,
  basePath: string,
  authors: Authors,
): Promise<void> {
  context.debug("Writing authors...")

  await writeConfig<{ [authorId in AuthorID]?: AuthorData }>(
    basePath,
    CONFIG_NAME,
    mapValues(authors, ({ alias, id, search, teams, ...data }) => ({
      alias: alias?.length ? alias.join(",") : undefined,
      teams: teams?.length ? teams.join(",") : undefined,
      ...data,
    })),
    ConfigFormat.YAML,
  )
}
