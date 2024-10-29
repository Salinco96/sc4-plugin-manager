import { TabContext, TabList, TabPanel } from "@mui/lab"
import { Box, Tab } from "@mui/material"
import { useTranslation } from "react-i18next"

import { PackageID } from "@common/packages"
import { FlexBox } from "@components/FlexBox"
import { PackageTag } from "@components/Tags"
import { useCurrentVariant, useDependentPackages } from "@utils/packages"

import { packageViewTabs, usePackageViewTab } from "./tabs"

export function PackageViewTabs({ packageId }: { packageId: PackageID }): JSX.Element | null {
  const { activeTab, setActiveTab } = usePackageViewTab()
  const { t } = useTranslation("PackageViewTabs")

  const dependentPackages = useDependentPackages(packageId)
  const variantInfo = useCurrentVariant(packageId)

  const tabs = packageViewTabs.filter(tab => tab.condition(variantInfo, dependentPackages))
  const labels = tabs.map(tab => tab.label(t, variantInfo, dependentPackages))
  const labelTags = tabs.map(tab => tab.labelTag?.(variantInfo))

  if (tabs.length === 0) {
    return null
  }

  const currentTab = tabs.find(tab => tab.id === activeTab) ?? tabs[0]

  return (
    <TabContext value={currentTab.id}>
      <Box borderBottom={1} borderColor="divider">
        <TabList onChange={(_, value) => setActiveTab(value)}>
          {tabs.map((tab, index) => (
            <Tab
              key={tab.id}
              label={
                <FlexBox alignItems="center" gap={1}>
                  {labels[index]}
                  {labelTags[index] && <PackageTag dense {...labelTags[index]} />}
                </FlexBox>
              }
              value={tab.id}
            />
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
