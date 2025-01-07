import type { ToolID } from "@common/tools"
import type { TabInfo } from "@components/Tabs"
import { ToolViewSummary } from "./ToolViewSummary"

export const toolViewTabs: TabInfo<{ toolId: ToolID }>[] = [
  {
    id: "summary",
    component: ToolViewSummary,
    condition() {
      return true
    },
    label(t) {
      return t("summary")
    },
  },
]
