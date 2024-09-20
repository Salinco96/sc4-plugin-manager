import { ID } from "./types"

/** Author ID */
export type AuthorID = ID<AuthorInfo>

/** Raw author data */
export interface AuthorData {
  /** Other pseudos */
  alias?: string[]
  /** Author most-used pseudo (e.g. on Simtropolis) */
  name: string
  /** Author URL (e.g. on Simtropolis) */
  url?: string
}

/** Loaded author data */
export interface AuthorInfo extends AuthorData {
  /** Author ID */
  id: AuthorID
  /** Search string */
  search: string
}

/** Loaded authors */
export type Authors = {
  [authorId in AuthorID]?: AuthorInfo
}

export function loadAuthorInfo(id: AuthorID, data: AuthorData): AuthorInfo {
  return {
    ...data,
    id,
    search: data.alias ? [data.name, ...data.alias].join("|") : data.name,
  }
}
