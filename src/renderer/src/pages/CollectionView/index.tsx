import { useTranslation } from "react-i18next"

import type { CollectionID } from "@common/collections"
import { CollectionHeader } from "@components/Collections/CollectionHeader"
import CollectionViewPackages from "@components/Collections/CollectionViewPackages"
import { Empty } from "@components/Empty"
import { Loader } from "@components/Loader"
import { type TabInfo, Tabs } from "@components/Tabs"
import { View } from "@components/View"
import { getCollectionInfo, store } from "@stores/main"

const tabs: TabInfo<{ collectionId: CollectionID }>[] = [
  {
    id: "packages",
    component: CollectionViewPackages,
    count({ collectionId }, state) {
      return getCollectionInfo(state, collectionId).packages.length
    },
    fullsize: true,
    label(t, count) {
      return t("packages", { count })
    },
  },
]

function CollectionView({ collectionId }: { collectionId: CollectionID }): JSX.Element {
  const exists = store.useStore(state => state.collections && !!state.collections[collectionId])

  const { t } = useTranslation("CollectionView")

  // Loading
  if (exists === undefined) {
    return (
      <View>
        <Loader />
      </View>
    )
  }

  // Missing
  if (exists === false) {
    return (
      <View>
        <Empty message={t("missing", { collectionId })} />
      </View>
    )
  }

  return (
    <View>
      <CollectionHeader collectionId={collectionId} />
      <Tabs tabs={tabs} collectionId={collectionId} />
    </View>
  )
}

export default CollectionView
