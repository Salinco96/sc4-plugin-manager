import { memo } from "react"

import {
  type CityID,
  type RegionID,
  getCityLinkedProfileId,
  getRegionLinkedProfileId,
} from "@common/regions"
import { ListItem } from "@components/ListItem"
import { useSettings, useStore } from "@utils/store"

import { PackageBanner } from "@components/PackageBanners/PackageBanner"
import { CityHeader } from "./CityHeader"

export const CityListItem = memo(function CollectionListItem(props: {
  cityId: CityID
  regionId: RegionID
}): JSX.Element {
  const profiles = useStore(store => store.profiles)
  const settings = useSettings()

  const regionProfileId = getRegionLinkedProfileId(props.regionId, settings, profiles)
  const cityProfileId = getCityLinkedProfileId(props.regionId, props.cityId, settings)

  return (
    <ListItem
      banners={
        !regionProfileId && !cityProfileId && <PackageBanner>No linked profile</PackageBanner>
      }
      header={CityHeader}
      {...props}
    />
  )
})
