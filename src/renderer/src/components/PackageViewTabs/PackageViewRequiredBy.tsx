import type { PackageID } from "@common/packages"
import { PackageList } from "@components/PackageList/PackageList"
import { useDependentPackages } from "@utils/packages"

export function PackageViewRequiredBy({ packageId }: { packageId: PackageID }): JSX.Element {
  const packageIds = useDependentPackages(packageId)

  return <PackageList packageIds={packageIds} />
}
