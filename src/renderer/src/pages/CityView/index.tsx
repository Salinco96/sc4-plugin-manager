import { useTranslation } from "react-i18next"

import type { CityID, RegionID } from "@common/regions"
import { CityHeader } from "@components/Cities/CityHeader"
import CityViewBackups from "@components/Cities/CityViewBackups"
import { Empty } from "@components/Empty"
import { Loader } from "@components/Loader"
import { type TabInfo, Tabs } from "@components/Tabs"
import { View } from "@components/View"
import { getRegionInfo, useStore } from "@utils/store"

const tabs: TabInfo<{ cityId: CityID; regionId: RegionID }>[] = [
  {
    id: "backups",
    component: CityViewBackups,
    condition() {
      return true
    },
    count({ cityId, regionId }, store) {
      return getRegionInfo(store, regionId)?.cities[cityId]?.backups.length ?? 0
    },
    fullsize: true,
    label(t, count) {
      return t("backups", { count })
    },
  },
]

function CityView({ cityId, regionId }: { cityId: CityID; regionId: RegionID }): JSX.Element {
  const isLoading = useStore(store => !store.regions)
  const exists = useStore(store => !!getRegionInfo(store, regionId)?.cities[cityId])

  const { t } = useTranslation("CityView")

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
