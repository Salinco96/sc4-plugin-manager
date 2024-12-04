import type { MaybeArray } from "@common/utils/types"
import type { VariantID } from "@common/variants"
import type { VariantData } from "./variants"

/**
 * Raw package data, as stored in YAML files
 *
 * Once published, this should be kept backward-compatible.
 */
export interface PackageData extends VariantData {
  /**
   * Included features, as an array of strings or a comma-separated string (will be trimmed and lowercased)
   *
   * - Contrary to other fields, this **cannot** be overridden by variants.
   */
  features?: MaybeArray<string>

  /**
   * Package name
   */
  name?: string

  /**
   * Available variants
   */
  variants?: {
    [variantId in VariantID]?: VariantData
  }
}
