import { normalizeString } from "./utils/types"

export interface ProfileExternals {
  [groupId: string]: boolean
}

export interface ProfileUpdate {
  name?: string
  externals?: ProfileExternals
}

export function createUniqueProfileId(name: string, existingIds: string[]): string {
  const baseId = normalizeString(name.trim())
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .join("-")

  if (baseId) {
    if (!existingIds.includes(baseId)) {
      return baseId
    }

    let index = 2
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const id = `${baseId}-${index}`
      if (!existingIds.includes(id)) {
        return id
      }

      index++
    }
  }

  let index = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const id = `${index}`
    if (!existingIds.includes(id)) {
      return id
    }

    index++
  }
}
