import { ProfileInfo } from "@common/types"

export function createUniqueProfileId(name: string, profiles: ProfileInfo[]): string {
  const existingIds = profiles.map(profile => profile.id)

  const baseId = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
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
