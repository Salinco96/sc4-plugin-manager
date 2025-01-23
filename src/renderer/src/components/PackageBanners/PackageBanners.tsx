import { isString } from "@salinco/nice-utils"

import {
  type PackageID,
  getVariantIssues,
  isConflict,
  isDeprecated,
  isEnabled,
  isExperimental,
  isMissing,
  isOutdated,
} from "@common/packages"
import type { VariantID } from "@common/variants"
import { store } from "@stores/main"

import { PackageBannerConflict } from "./PackageBannerConflict"
import { PackageBannerDeprecated } from "./PackageBannerDeprecated"
import { PackageBannerExperimental } from "./PackageBannerExperimental"
import { PackageBannerIncompatible } from "./PackageBannerIncompatible"
import { PackageBannerMissing } from "./PackageBannerMissing"
import { PackageBannerOutdated } from "./PackageBannerOutdated"
import { PackageBannerWarning } from "./PackageBannerWarning"

export function PackageBanners({
  packageId,
  variantId,
}: {
  packageId: PackageID
  variantId?: VariantID
}): JSX.Element {
  const packageStatus = store.usePackageStatus(packageId)
  const variantInfo = store.useVariantInfo(packageId, variantId)

  const issues = getVariantIssues(variantInfo, packageStatus)

  return (
    <>
      {isMissing(variantInfo, packageStatus) && (
        <PackageBannerMissing packageId={packageId} variantId={variantInfo.id} />
      )}
      {isOutdated(variantInfo) && (
        <PackageBannerOutdated packageId={packageId} variantId={variantInfo.id} />
      )}
      {isDeprecated(variantInfo) && (
        <PackageBannerDeprecated
          packageId={packageId}
          superseded={isString(variantInfo.deprecated) ? variantInfo.deprecated : undefined}
        />
      )}
      {isExperimental(variantInfo) && <PackageBannerExperimental />}
      {issues?.map(issue =>
        isConflict(issue, variantInfo, packageStatus) ? (
          <PackageBannerConflict key={issue.id} issue={issue} />
        ) : (
          <PackageBannerIncompatible
            key={issue.id}
            issue={issue}
            packageId={packageId}
            variantId={variantInfo.id}
          />
        ),
      )}
      {variantInfo.warnings?.map(
        (warning, index) =>
          warning.on !== (isEnabled(packageStatus) ? "enable" : "disable") && (
            // biome-ignore lint/suspicious/noArrayIndexKey: no better key...
            <PackageBannerWarning key={index} warning={warning} />
          ),
      )}
    </>
  )
}
