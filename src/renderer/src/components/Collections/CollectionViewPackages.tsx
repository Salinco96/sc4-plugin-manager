import type { CollectionID } from "@common/collections"
import { PackageList } from "@components/PackageList/PackageList"
import { store } from "@stores/main"

export default function CollectionViewPackages({
  collectionId,
}: { collectionId: CollectionID }): JSX.Element {
  const { packages } = store.useCollectionInfo(collectionId)

  return <PackageList packageIds={packages} />
}
