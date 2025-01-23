import {
  type CityID,
  type RegionID,
  getCityLinkedProfileId,
  getRegionLinkedProfileId,
} from "@common/regions"
import { Banner } from "@components/Banner"
import { size } from "@salinco/nice-utils"
import { store } from "@stores/main"

export function CityBanners({
  cityId,
  regionId,
}: {
  cityId: CityID
  regionId: RegionID
}): JSX.Element {
  const isUnlinked = store.useStore(
    state =>
      !!state.profiles &&
      size(state.profiles) > 1 &&
      !getRegionLinkedProfileId(regionId, state.settings, state.profiles) &&
      !getCityLinkedProfileId(regionId, cityId, state.settings),
  )

  return <>{isUnlinked && <Banner>No linked profile</Banner>}</>
}
