import { memo } from "react"

import type { RegionID } from "@common/regions"
import { ListItem } from "@components/ListItem"

import { RegionHeader } from "./RegionHeader"

export const RegionListItem = memo(function CollectionListItem(props: {
  regionId: RegionID
}): JSX.Element {
  return <ListItem header={RegionHeader} {...props} />
})
