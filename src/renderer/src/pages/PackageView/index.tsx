import { useTranslation } from "react-i18next"

import type { PackageID } from "@common/packages"
import { Empty } from "@components/Empty"
import { Loader } from "@components/Loader"
import { PackageHeader } from "@components/PackageHeader"
import { packageViewTabs } from "@components/PackageViewTabs/tabs"
import { Tabs } from "@components/Tabs"
import { View } from "@components/View"
import { store } from "@stores/main"

function PackageView({ packageId }: { packageId: PackageID }): JSX.Element {
  const exists = store.useStore(state => state.packages && !!state.packages[packageId])

  const { t } = useTranslation("PackageView")

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
        <Empty message={t("missing", { packageId })} />
      </View>
    )
  }

  return (
    <View>
      <PackageHeader packageId={packageId} />
      <Tabs tabs={packageViewTabs} packageId={packageId} />
    </View>
  )
}

export default PackageView
