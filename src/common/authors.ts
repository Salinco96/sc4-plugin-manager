import type { ID } from "@salinco/nice-utils"

import { type MaybeArray, parseStringArray } from "./utils/types"

/** Author ID */
export type AuthorID = ID<string, AuthorInfo>

/** Raw author data */
export interface AuthorData {
  /** Other pseudos */
  alias?: MaybeArray<string>
  /** Author most-used pseudo (e.g. on Simtropolis) */
  name: string
  /** Avatar thumbnail URL (e.g. on Simtropolis) */
  thumbnail?: string
  /** Author URL (e.g. on Simtropolis) */
  url?: string
}

/** Loaded author data */
export interface AuthorInfo {
  /** Other pseudos */
  alias?: string[]
  /** Author ID */
  id: AuthorID
  /** Author most-used pseudo (e.g. on Simtropolis) */
  name: string
  /** Avatar thumbnail URL (e.g. on Simtropolis) */
  thumbnail?: string
  /** Author URL (e.g. on Simtropolis) */
  url?: string
  /** Search string */
  search?: string
}

/** Loaded authors */
export type Authors = {
  [authorId in AuthorID]?: AuthorInfo
}

export function loadAuthorInfo(id: AuthorID, data: AuthorData): AuthorInfo {
  const alias = data.alias ? parseStringArray(data.alias) : undefined

  return {
    ...data,
    alias,
    id,
    search: alias ? [data.name, ...alias].join("|") : undefined,
  }
}

export function writeAuthorInfo(info: AuthorInfo): AuthorData {
  const { id, search, alias, ...data } = info

  return {
    alias: alias?.length ? alias.join(",") : undefined,
    ...data,
  }
}
