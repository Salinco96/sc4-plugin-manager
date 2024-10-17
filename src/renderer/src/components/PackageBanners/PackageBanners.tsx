import {
  PackageID,
  getVariantIssues,
  isConflict,
  isDeprecated,
  isExperimental,
  isMissing,
  isOutdated,
} from "@common/packages"
import { isString } from "@common/utils/types"
import { useCurrentVariant, usePackageStatus } from "@utils/packages"

import { PackageBannerConflict } from "./PackageBannerConflict"
import { PackageBannerDeprecated } from "./PackageBannerDeprecated"
import { PackageBannerExperimental } from "./PackageBannerExperimental"
import { PackageBannerIncompatible } from "./PackageBannerIncompatible"
import { PackageBannerMissing } from "./PackageBannerMissing"
import { PackageBannerOutdated } from "./PackageBannerOutdated"

export function PackageBanners({ packageId }: { packageId: PackageID }): JSX.Element {
  const packageStatus = usePackageStatus(packageId)
  const variantInfo = useCurrentVariant(packageId)
  const variantId = variantInfo.id

  const issues = getVariantIssues(variantInfo, packageStatus)

  return (
    <>
      {isMissing(variantInfo, packageStatus) && (
        <PackageBannerMissing packageId={packageId} variantId={variantId} />
      )}
      {isOutdated(variantInfo) && (
        <PackageBannerOutdated packageId={packageId} variantId={variantId} />
      )}
      {isDeprecated(variantInfo) && (
        <PackageBannerDeprecated
          packageId={packageId}
          superseded={isString(variantInfo.deprecated) ? variantInfo.deprecated : undefined}
        />
      )}
      {isExperimental(variantInfo) && <PackageBannerExperimental />}
      {issues?.map(issue =>
        isConflict(issue, packageStatus) ? (
          <PackageBannerConflict key={issue.id} issue={issue} />
        ) : (
          <PackageBannerIncompatible
            key={issue.id}
            issue={issue}
            packageId={packageId}
            variantId={variantId}
          />
        ),
      )}
    </>
  )
}
