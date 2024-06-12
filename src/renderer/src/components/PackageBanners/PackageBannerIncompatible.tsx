import { DoDisturb as IncompatibleIcon } from "@mui/icons-material"

import { usePackageInfo, useVariantInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerIncompatible({
  packageId,
  reason,
  variantId,
}: {
  packageId: string
  reason: string
  variantId: string
}): JSX.Element {
  const actions = useStoreActions()

  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useVariantInfo(packageId, variantId)

  return (
    <PackageBanner
      action={{
        description: "Replace existing packages",
        label: "Replace",
        onClick: () => actions.addPackage(packageInfo.id, variantInfo.id),
      }}
      color="incompatible"
      header="Incompatible"
      icon={<IncompatibleIcon />}
    >
      {reason}
    </PackageBanner>
  )
}
