import { Update as UpdateIcon } from "@mui/icons-material"

import { usePackageInfo, useVariantInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerOutdated({
  packageId,
  variantId,
}: {
  packageId: string
  variantId: string
}): JSX.Element {
  const actions = useStoreActions()

  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useVariantInfo(packageId, variantId)

  return (
    <PackageBanner
      action={{
        description: `Update to version ${variantInfo.update?.version}`,
        label: "Update",
        onClick: () => actions.updatePackage(packageInfo.id, variantInfo.id),
      }}
      header="Outdated"
      icon={<UpdateIcon />}
    >
      A new version of this package is available.
    </PackageBanner>
  )
}
