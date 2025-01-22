import { memo } from "react"

import { type RegionID, getRegionLinkedProfileId } from "@common/regions"
import { ListItem } from "@components/ListItem"

import { PackageBanner } from "@components/PackageBanners/PackageBanner"
import { useSettings, useStore } from "@utils/store"
import { RegionHeader } from "./RegionHeader"

export const RegionListItem = memo(function CollectionListItem(props: {
  regionId: RegionID
}): JSX.Element {
  const profiles = useStore(store => store.profiles)
  const settings = useSettings()

  const regionProfileId = getRegionLinkedProfileId(props.regionId, settings, profiles)

  return (
    <ListItem
      banners={!regionProfileId && <PackageBanner>No linked profile</PackageBanner>}
      header={RegionHeader}
      {...props}
    />
  )
})
