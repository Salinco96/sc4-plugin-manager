import { TabContext, TabList, TabPanel } from "@mui/lab"
import { Box, Tab } from "@mui/material"
import { useTranslation } from "react-i18next"

import { useStore } from "@utils/store"

import { packageViewTabs, usePackageViewTab } from "./tabs"

export function PackageViewTabs({ packageId }: { packageId: string }): JSX.Element | null {
  const { activeTab, setActiveTab } = usePackageViewTab()
  const { t } = useTranslation("PackageViewTabs")

  const tabs = useStore(store => packageViewTabs.filter(tab => tab.condition(packageId, store)))
  const labels = useStore(store => tabs.map(tab => tab.label(t, packageId, store)))

  if (tabs.length === 0) {
    return null
  }

  const currentTab = tabs.find(tab => tab.id === activeTab) ?? tabs[0]

  return (
    <TabContext value={currentTab.id}>
      <Box borderBottom={1} borderColor="divider">
        <TabList onChange={(_, value) => setActiveTab(value)}>
          {tabs.map((tab, index) => (
            <Tab key={tab.id} label={labels[index]} value={tab.id} />
          ))}
        </TabList>
      </Box>
      {tabs.map(({ component: Component, fullsize, id }) => (
        <TabPanel
          key={id}
          sx={{
            height: "100%",
            overflowY: fullsize ? "hidden" : "auto",
            padding: fullsize ? 0 : 2,
          }}
          value={id}
        >
          <Component packageId={packageId} />
        </TabPanel>
      ))}
    </TabContext>
  )
}
