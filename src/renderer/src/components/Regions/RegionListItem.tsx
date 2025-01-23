import { memo } from "react"

import type { RegionID } from "@common/regions"
import { ListItem } from "@components/ListItem"

import { RegionBanners } from "./RegionBanners"
import { RegionHeader } from "./RegionHeader"

export const RegionListItem = memo(function CollectionListItem(props: {
  regionId: RegionID
}): JSX.Element {
  return <ListItem banners={RegionBanners} header={RegionHeader} {...props} />
})
