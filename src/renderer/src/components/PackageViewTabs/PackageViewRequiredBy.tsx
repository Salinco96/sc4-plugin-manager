import { PackageList } from "@components/PackageList/PackageList"
import { useDependentPackages } from "@utils/packages"
import type { PackageViewTabInfoProps } from "./tabs"

export default function PackageViewRequiredBy({ packageId }: PackageViewTabInfoProps): JSX.Element {
  const packageIds = useDependentPackages(packageId)

  return <PackageList packageIds={packageIds} />
}
