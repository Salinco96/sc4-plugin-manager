import { memo } from "react"

import type { CityID, RegionID } from "@common/regions"
import { ListItem } from "@components/ListItem"

import { CityHeader } from "./CityHeader"

export const CityListItem = memo(function CollectionListItem(props: {
  cityId: CityID
  regionId: RegionID
}): JSX.Element {
  return <ListItem header={CityHeader} {...props} />
})
