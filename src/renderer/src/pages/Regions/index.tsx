import { sortBy, values } from "@salinco/nice-utils"

import { Loader } from "@components/Loader"
import { RegionList } from "@components/Regions/RegionList"
import { store } from "@stores/main"

function Regions(): JSX.Element {
  const regions = store.useRegions()

  if (!regions) {
    return <Loader />
  }

  const regionIds = sortBy(values(regions), region => region.name).map(region => region.id)

  return <RegionList regionIds={regionIds} />
}

export default Regions
