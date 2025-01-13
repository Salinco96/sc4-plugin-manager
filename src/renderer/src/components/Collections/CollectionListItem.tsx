import { memo } from "react"

import type { CollectionID } from "@common/collections"
import { ListItem } from "@components/ListItem"

import { CollectionHeader } from "./CollectionHeader"

export const CollectionListItem = memo(function CollectionListItem(props: {
  collectionId: CollectionID
}): JSX.Element {
  return <ListItem header={CollectionHeader} {...props} />
})
