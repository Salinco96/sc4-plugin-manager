import { sortBy, values } from "@salinco/nice-utils"

import { Loader } from "@components/Loader"
import { useStore } from "@utils/store"
import { RegionList } from "../../components/Regions/RegionList"

function Regions(): JSX.Element {
  const regions = useStore(store => store.regions)

  if (!regions) {
    return <Loader />
  }

  const regionIds = sortBy(values(regions), region => region.name).map(region => region.id)

  return <RegionList regionIds={regionIds} />
}

export default Regions
