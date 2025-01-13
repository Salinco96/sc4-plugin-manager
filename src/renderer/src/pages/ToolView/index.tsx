import { useTranslation } from "react-i18next"

import type { ToolID } from "@common/tools"
import { Empty } from "@components/Empty"
import { Loader } from "@components/Loader"
import { type TabInfo, Tabs } from "@components/Tabs"
import { ToolViewSummary } from "@components/ToolViewTabs/ToolViewSummary"
import { ToolHeader } from "@components/Tools/ToolHeader"
import { View } from "@components/View"
import { getToolInfo, useStore } from "@utils/store"

const tabs: TabInfo<{ toolId: ToolID }>[] = [
  {
    id: "summary",
    component: ToolViewSummary,
    label(t) {
      return t("summary")
    },
  },
]

function ToolView({ id: toolId }: { id: ToolID }): JSX.Element {
  const isLoading = useStore(store => !store.tools)
  const exists = useStore(store => !!getToolInfo(store, toolId))

  const { t } = useTranslation("ToolView")

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
        <Empty message={t("missing", { toolId })} />
      </View>
    )
  }

  return (
    <View>
      <ToolHeader toolId={toolId} />
      <Tabs tabs={tabs} toolId={toolId} />
    </View>
  )
}

export default ToolView
