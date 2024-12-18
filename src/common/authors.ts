import type { ID } from "@salinco/nice-utils"

/** Author ID */
export type AuthorID = ID<string, AuthorInfo>

/** Loaded author data */
export interface AuthorInfo {
  /** Other pseudos */
  alias?: string[]
  /** Author ID */
  id: AuthorID
  /** Author most-used pseudo (e.g. on Simtropolis) */
  name: string
  /** Teams */
  teams?: AuthorID[]
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
