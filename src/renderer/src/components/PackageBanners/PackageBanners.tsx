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

  const issues = packageStatus.issues[variantId]

  return (
    <>
      {packageStatus.enabled && !variantInfo.installed && (
        <PackageBannerMissing packageId={packageId} variantId={variantId} />
      )}
      {variantInfo.update && <PackageBannerOutdated packageId={packageId} variantId={variantId} />}
      {variantInfo.deprecated && <PackageBannerDeprecated />}
      {variantInfo.experimental && <PackageBannerExperimental />}
      {issues?.map(reason =>
        packageStatus.enabled ? (
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
