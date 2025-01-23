import { type RegionID, getRegionLinkedProfileId } from "@common/regions"
import { Banner } from "@components/Banner"
import { size } from "@salinco/nice-utils"
import { store } from "@stores/main"

export function RegionBanners({
  regionId,
}: {
  regionId: RegionID
}): JSX.Element {
  const isUnlinked = store.useStore(
    state =>
      !!state.profiles &&
      size(state.profiles) > 1 &&
      !getRegionLinkedProfileId(regionId, state.settings, state.profiles),
  )

  return <>{isUnlinked && <Banner>No linked profile</Banner>}</>
}
