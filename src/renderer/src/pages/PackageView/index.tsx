import { useTranslation } from "react-i18next"

import type { PackageID } from "@common/packages"
import { Empty } from "@components/Empty"
import { Loader } from "@components/Loader"
import { PackageHeader } from "@components/PackageHeader"
import { packageViewTabs } from "@components/PackageViewTabs/tabs"
import { Tabs } from "@components/Tabs"
import { View } from "@components/View"
import { useStore } from "@utils/store"

function PackageView({ packageId }: { packageId: PackageID }): JSX.Element {
  const isLoading = useStore(store => !store.packages)
  const exists = useStore(store => !!store.packages?.[packageId])

  const { t } = useTranslation("PackageView")

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
