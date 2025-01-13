import { useTranslation } from "react-i18next"

import type { CollectionID } from "@common/collections"
import { CollectionHeader } from "@components/Collections/CollectionHeader"
import CollectionViewPackages from "@components/Collections/CollectionViewPackages"
import { Empty } from "@components/Empty"
import { Loader } from "@components/Loader"
import { type TabInfo, Tabs } from "@components/Tabs"
import { View } from "@components/View"
import { getCollectionInfo, useStore } from "@utils/store"

const tabs: TabInfo<{ collectionId: CollectionID }>[] = [
  {
    id: "packages",
    component: CollectionViewPackages,
    count({ collectionId }, store) {
      return getCollectionInfo(store, collectionId)?.packages.length ?? 0
    },
    fullsize: true,
    label(t, count) {
      return t("packages", { count })
    },
  },
]

function CollectionView({ id: collectionId }: { id: CollectionID }): JSX.Element {
  const isLoading = useStore(store => !store.collections)
  const exists = useStore(store => !!getCollectionInfo(store, collectionId))

  const { t } = useTranslation("CollectionView")

  if (isLoading) {
    return (
      <View>
        <Loader />
      </View>
    )
  }

  if (!exists) {
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
