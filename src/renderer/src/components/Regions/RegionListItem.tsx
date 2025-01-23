import { size } from "@salinco/nice-utils"
import { memo } from "react"

import { type RegionID, getRegionLinkedProfileId } from "@common/regions"
import { ListItem } from "@components/ListItem"
import { PackageBanner } from "@components/PackageBanners/PackageBanner"

import { store } from "@stores/main"
import { RegionHeader } from "./RegionHeader"

export const RegionListItem = memo(function CollectionListItem(props: {
  regionId: RegionID
}): JSX.Element {
  const isUnlinked = store.useStore(
    state =>
      !!state.profiles &&
      size(state.profiles) > 1 &&
      !getRegionLinkedProfileId(props.regionId, state.settings, state.profiles),
  )

  return (
    <ListItem
      banners={isUnlinked && <PackageBanner>No linked profile</PackageBanner>}
      header={RegionHeader}
      {...props}
    />
  )
})
