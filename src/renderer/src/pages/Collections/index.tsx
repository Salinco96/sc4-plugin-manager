import { keys, sort } from "@salinco/nice-utils"

import { Loader } from "@components/Loader"
import { useStore } from "@utils/store"
import { CollectionList } from "../../components/Collections/CollectionList"

function Collections(): JSX.Element {
  const collections = useStore(store => store.collections)

  if (!collections) {
    return <Loader />
  }

  const collectionIds = sort(keys(collections))

  return <CollectionList collectionIds={collectionIds} />
}

export default Collections
