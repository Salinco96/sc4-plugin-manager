import { t } from "./i18n"
import { ID, PackageState, VariantInfo } from "./types"

/** Variant ID */
export type VariantID = ID<VariantInfo>

export function getStateLabel(state: PackageState): string {
  return t(state, { ns: "PackageState" })
}
