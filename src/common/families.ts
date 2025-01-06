import type { ID } from "@salinco/nice-utils"

export type FamilyID = ID<string, FamilyInfo>

export interface FamilyInfo {
  /**
   * Path to exemplar file (POSIX)
   */
  file?: string

  /**
   * Family ID
   */
  id: FamilyID

  /**
   * Family name
   */
  name?: string
}
