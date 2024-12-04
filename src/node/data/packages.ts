import type { PackageInfo } from "@common/types"
import type { MaybeArray } from "@common/utils/types"
import type { VariantID } from "@common/variants"
import { filterValues, mapValues } from "@salinco/nice-utils"
import { type VariantData, writeVariantInfo } from "./variants"

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

export function writePackageInfo(packageInfo: PackageInfo): PackageData {
  return {
    features: packageInfo.features?.length ? packageInfo.features : undefined,
    name: packageInfo.name,
    variants: mapValues(
      filterValues(packageInfo.variants, variant => !!variant.installed),
      writeVariantInfo,
    ),
  }
}
