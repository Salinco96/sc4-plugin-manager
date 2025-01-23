import { size } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import type { RegionID } from "@common/regions"
import { Empty } from "@components/Empty"
import { Loader } from "@components/Loader"
import { RegionHeader } from "@components/Regions/RegionHeader"
import RegionViewCities from "@components/Regions/RegionViewCities"
import { type TabInfo, Tabs } from "@components/Tabs"
import { View } from "@components/View"
import { getRegionInfo, store } from "@stores/main"

const tabs: TabInfo<{ regionId: RegionID }>[] = [
  {
    id: "cities",
    component: RegionViewCities,
    count({ regionId }, state) {
      return size(getRegionInfo(state, regionId).cities)
    },
    fullsize: true,
    label(t, count) {
      return t("cities", { count })
    },
  },
]

function RegionView({ regionId }: { regionId: RegionID }): JSX.Element {
  const exists = store.useStore(state => state.regions && !!state.regions[regionId])

  const { t } = useTranslation("RegionView")

  // Loading
  if (exists === undefined) {
    return (
      <View>
        <Loader />
      </View>
    )
  }

  // Missing
  if (exists === false) {
    return (
      <View>
        <Empty message={t("missing", { regionId })} />
      </View>
    )
  }

  return (
    <View>
      <RegionHeader regionId={regionId} />
      <Tabs tabs={tabs} regionId={regionId} />
    </View>
  )
}

export default RegionView
