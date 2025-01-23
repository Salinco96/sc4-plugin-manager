import type { PackageID } from "@common/packages"
import { PackageList } from "@components/PackageList/PackageList"
import { store } from "@stores/main"
import { getDependentPackages } from "@utils/packages"

export default function PackageViewRequiredBy({
  packageId,
}: { packageId: PackageID }): JSX.Element {
  const packages = store.usePackages()

  const packageIds = packages ? getDependentPackages(packages, packageId) : []

  return <PackageList packageIds={packageIds} />
}
