import { TabContext, TabList, TabPanel } from "@mui/lab"
import { Box, Tab } from "@mui/material"

import { useCurrentVariant, usePackageStatus } from "@utils/packages"

import { packageViewTabs, usePackageViewTab } from "./tabs"

export function PackageViewTabs({ packageId }: { packageId: string }): JSX.Element | null {
  const { activeTab, setActiveTab } = usePackageViewTab()

  const packageStatus = usePackageStatus(packageId)
  const variantInfo = useCurrentVariant(packageId)

  const tabs = packageViewTabs.filter(tab => tab.condition(variantInfo, packageStatus))
  if (tabs.length === 0) {
    return null
  }

  const currentTab = tabs.find(tab => tab.id === activeTab) ?? tabs[0]

  return (
    <TabContext value={currentTab.id}>
      <Box borderBottom={1} borderColor="divider">
        <TabList onChange={(_, value) => setActiveTab(value)}>
          {tabs.map(tab => (
            <Tab key={tab.id} label={tab.name(variantInfo, packageStatus)} value={tab.id} />
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
