import { useTranslation } from "react-i18next"

import type { CityID, RegionID } from "@common/regions"
import { CityHeader } from "@components/Cities/CityHeader"
import CityViewBackups from "@components/Cities/CityViewBackups"
import { Empty } from "@components/Empty"
import { Loader } from "@components/Loader"
import { type TabInfo, Tabs } from "@components/Tabs"
import { View } from "@components/View"
import { getCityInfo, store } from "@stores/main"

const tabs: TabInfo<{ cityId: CityID; regionId: RegionID }>[] = [
  {
    id: "backups",
    component: CityViewBackups,
    condition() {
      return true
    },
    count({ cityId, regionId }, state) {
      return getCityInfo(state, regionId, cityId).backups.length
    },
    fullsize: true,
    label(t, count) {
      return t("backups", { count })
    },
  },
]

function CityView({ cityId, regionId }: { cityId: CityID; regionId: RegionID }): JSX.Element {
  const exists = store.useStore(store => store.regions && !!store.regions[regionId]?.cities[cityId])

  const { t } = useTranslation("CityView")

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
        <Empty message={t("missing", { cityId })} />
      </View>
    )
  }

  return (
    <View>
      <CityHeader cityId={cityId} regionId={regionId} />
      <Tabs tabs={tabs} cityId={cityId} regionId={regionId} />
    </View>
  )
}

export default CityView
