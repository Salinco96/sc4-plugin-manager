import { size } from "@salinco/nice-utils"
import { memo } from "react"

import {
  type CityID,
  type RegionID,
  getCityLinkedProfileId,
  getRegionLinkedProfileId,
} from "@common/regions"
import { ListItem } from "@components/ListItem"
import { PackageBanner } from "@components/PackageBanners/PackageBanner"
import { store } from "@stores/main"

import { CityHeader } from "./CityHeader"

export const CityListItem = memo(function CollectionListItem(props: {
  cityId: CityID
  regionId: RegionID
}): JSX.Element {
  const isUnlinked = store.useStore(
    state =>
      !!state.profiles &&
      size(state.profiles) > 1 &&
      !getRegionLinkedProfileId(props.regionId, state.settings, state.profiles) &&
      !getCityLinkedProfileId(props.regionId, props.cityId, state.settings),
  )

  return (
    <ListItem
      banners={isUnlinked && <PackageBanner>No linked profile</PackageBanner>}
      header={CityHeader}
      {...props}
    />
  )
})
