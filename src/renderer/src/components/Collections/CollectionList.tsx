import type { CollectionID } from "@common/collections"
import { FlexBox } from "@components/FlexBox"
import { List } from "@components/List"
import { useNavigation } from "@utils/navigation"

import { CollectionListItem } from "./CollectionListItem"

export function CollectionList({ collectionIds }: { collectionIds: CollectionID[] }): JSX.Element {
  const { fromCollectionId } = useNavigation()

  return (
    <FlexBox direction="column" height="100%">
      <List
        items={collectionIds}
        initialItem={fromCollectionId}
        renderItem={collectionId => <CollectionListItem collectionId={collectionId} />}
      />
    </FlexBox>
  )
}
