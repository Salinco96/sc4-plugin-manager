import type { GroupID, InstanceID } from "./dbpf"

export type FamilyID = InstanceID<FamilyInfo>

export interface FamilyInfo {
  /**
   * Path to exemplar file (POSIX)
   */
  file?: string

  /**
   * Group ID
   */
  group?: GroupID

  /**
   * Family ID
   */
  id: FamilyID

  /**
   * Family name
   */
  name?: string
}
