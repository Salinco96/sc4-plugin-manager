import { useTranslation } from "react-i18next"

import type { ToolID } from "@common/tools"
import { Empty } from "@components/Empty"
import { Loader } from "@components/Loader"
import { type TabInfo, Tabs } from "@components/Tabs"
import { ToolViewSummary } from "@components/ToolViewTabs/ToolViewSummary"
import { ToolHeader } from "@components/Tools/ToolHeader"
import { View } from "@components/View"
import { store } from "@stores/main"

const tabs: TabInfo<{ toolId: ToolID }>[] = [
  {
    id: "summary",
    component: ToolViewSummary,
    label(t) {
      return t("summary")
    },
  },
]

function ToolView({ toolId }: { toolId: ToolID }): JSX.Element {
  const exists = store.useStore(state => state.tools && !!state.tools[toolId])

  const { t } = useTranslation("ToolView")

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
