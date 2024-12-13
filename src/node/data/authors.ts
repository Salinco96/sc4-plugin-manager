import { toLowerCase, unique } from "@salinco/nice-utils"

import type { AuthorID } from "@common/authors"
import { type MaybeArray, parseStringArray } from "@common/utils/types"

export function loadAuthors(data: MaybeArray<string>, ownerId: AuthorID): AuthorID[] {
  return unique([ownerId, ...parseStringArray(data).map(toLowerCase)] as AuthorID[])
}
