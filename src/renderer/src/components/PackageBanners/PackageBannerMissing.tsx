import { NotListedLocation as MissingIcon } from "@mui/icons-material"

import { PackageID } from "@common/packages"
import { values } from "@common/utils/objects"
import { VariantID } from "@common/variants"
import { usePackageInfo, useVariantInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerMissing({
  packageId,
  variantId,
}: {
  packageId: PackageID
  variantId: VariantID
}): JSX.Element {
  const actions = useStoreActions()

  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useVariantInfo(packageId, variantId)

  const message = values(packageInfo.variants).some(variant => variant.installed)
    ? "The selected variant is not installed."
    : "This package is not installed."

  return (
    <PackageBanner
      action={{
        description: "Install selected variant",
        label: "Install",
        onClick: () => actions.installPackage(packageInfo.id, variantInfo.id),
      }}
      header="Missing"
      icon={<MissingIcon />}
    >
      {message}
    </PackageBanner>
  )
}
