import type { FamilyID, FamilyInfo } from "@common/families"

export interface FamilyData {
  /**
   * Family name
   */
  name?: string
}

export function loadFamilyInfo(file: string, id: FamilyID, data: FamilyData): FamilyInfo {
  return { file, id, ...data }
}

export function writeFamilyInfo(family: FamilyInfo): FamilyData {
  const { file, id, ...others } = family
  return others
}
