import type { CollectionID } from "@common/collections"
import { PackageList } from "@components/PackageList/PackageList"
import { useCollectionInfo } from "@utils/packages"

export default function CollectionViewPackages({
  collectionId,
}: { collectionId: CollectionID }): JSX.Element {
  const { packages } = useCollectionInfo(collectionId)

  return <PackageList packageIds={packages} />
}
