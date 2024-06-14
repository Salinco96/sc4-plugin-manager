import {
  getVariantIssues,
  isDeprecated,
  isEnabled,
  isExperimental,
  isMissing,
  isOutdated,
} from "@common/packages"
import { useCurrentVariant, usePackageStatus } from "@utils/packages"

import { PackageBannerConflict } from "./PackageBannerConflict"
import { PackageBannerDeprecated } from "./PackageBannerDeprecated"
import { PackageBannerExperimental } from "./PackageBannerExperimental"
import { PackageBannerIncompatible } from "./PackageBannerIncompatible"
import { PackageBannerMissing } from "./PackageBannerMissing"
import { PackageBannerOutdated } from "./PackageBannerOutdated"

export function PackageBanners({ packageId }: { packageId: string }): JSX.Element {
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
      {isDeprecated(variantInfo) && <PackageBannerDeprecated />}
      {isExperimental(variantInfo) && <PackageBannerExperimental />}
      {issues?.map(reason =>
        isEnabled(variantInfo, packageStatus) ? (
          <PackageBannerConflict key={reason} reason={reason} />
        ) : (
          <PackageBannerIncompatible
            key={reason}
            packageId={packageId}
            reason={reason}
            variantId={variantId}
          />
        ),
      )}
    </>
  )
}
