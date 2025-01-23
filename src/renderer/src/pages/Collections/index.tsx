import { keys, sort } from "@salinco/nice-utils"

import { CollectionList } from "@components/Collections/CollectionList"
import { Loader } from "@components/Loader"
import { store } from "@stores/main"

function Collections(): JSX.Element {
  const collections = store.useCollections()

  if (!collections) {
    return <Loader />
  }

  const collectionIds = sort(keys(collections))

  return <CollectionList collectionIds={collectionIds} />
}

export default Collections
