import { size } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import type { RegionID } from "@common/regions"
import { Empty } from "@components/Empty"
import { Loader } from "@components/Loader"
import { RegionHeader } from "@components/Regions/RegionHeader"
import RegionViewCities from "@components/Regions/RegionViewCities"
import { type TabInfo, Tabs } from "@components/Tabs"
import { View } from "@components/View"
import { getRegionInfo, useStore } from "@utils/store"

const tabs: TabInfo<{ regionId: RegionID }>[] = [
  {
    id: "cities",
    component: RegionViewCities,
    count({ regionId }, store) {
      return size(getRegionInfo(store, regionId)?.cities ?? {})
    },
    fullsize: true,
    label(t, count) {
      return t("cities", { count })
    },
  },
]

function RegionView({ regionId }: { regionId: RegionID }): JSX.Element {
  const isLoading = useStore(store => !store.regions)
  const exists = useStore(store => !!getRegionInfo(store, regionId))

  const { t } = useTranslation("RegionView")

  if (isLoading) {
    return (
      <View>
        <Loader />
      </View>
    )
  }

  if (!exists) {
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
