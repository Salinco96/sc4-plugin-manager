import type { PackageID } from "@common/packages"
import { PackageActions } from "@components/PackageActions"
import { Page, useLocation } from "@utils/navigation"
import { useCurrentVariant, usePackageInfo } from "@utils/packages"
import { Header } from "./Header"
import { PackageTags } from "./Tags/PackageTags"

export function PackageHeader({
  isListItem,
  packageId,
  setActive,
}: {
  isListItem?: boolean
  packageId: PackageID
  setActive?: (active: boolean) => void
}): JSX.Element {
  const { page } = useLocation()
  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useCurrentVariant(packageId)

  return (
    <Header
      actions={<PackageActions filtered={page === Page.Packages} packageId={packageId} />}
      description={variantInfo.description}
      images={variantInfo.images}
      isListItem={isListItem}
      location={{ data: { packageId }, page: Page.PackageView }}
      setActive={setActive}
      subtitle={`${packageId}#${variantInfo.id}`}
      summary={variantInfo.summary}
      thumbnail={variantInfo.thumbnail}
      title={`${packageInfo.name} (${variantInfo.version})`}
      tags={<PackageTags packageId={packageId} />}
      // tools={<PackageTools packageId={packageId} />}
    />
  )
}
