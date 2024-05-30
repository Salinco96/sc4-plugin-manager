import { normalizeString } from "./utils/types"

export interface ProfileSettings {
  cam: boolean
  darknite: boolean
  rhd: boolean
}

export interface ProfileUpdate {
  name?: string
  settings?: Partial<ProfileSettings>
}

export const defaultProfileSettings: ProfileSettings = {
  cam: false,
  darknite: false,
  rhd: false,
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
