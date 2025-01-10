import type { GroupID } from "@common/dbpf"
import type { FamilyID, FamilyInfo } from "@common/families"

export interface FamilyData {
  /**
   * Family name
   */
  name?: string
}

export function loadFamilyInfo(
  file: string,
  group: GroupID,
  id: FamilyID,
  data: FamilyData,
): FamilyInfo {
  return {
    file,
    group,
    id,
    name: data.name,
  }
}

export function writeFamilyInfo(family: FamilyInfo): FamilyData {
  return {
    name: family.name,
  }
}
