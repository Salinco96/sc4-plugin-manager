import { TabContext, TabList, TabPanel } from "@mui/lab"
import { Box, Tab } from "@mui/material"
import { Suspense } from "react"
import { useTranslation } from "react-i18next"

import { FlexBox } from "@components/FlexBox"
import { Loader } from "@components/Loader"
import { PackageTag } from "@components/Tags/PackageTag"
import { useCurrentVariant, useDependentPackages, usePackageInfo } from "@utils/packages"
import { useStore, useStoreActions } from "@utils/store"

import { type PackageViewTabInfoProps, packageViewTabs } from "./tabs"

export function PackageViewTabs({ packageId }: PackageViewTabInfoProps): JSX.Element | null {
  const actions = useStoreActions()
  const activeTab = useStore(store => store.packageView.activeTab)

  const { t } = useTranslation("PackageViewTabs")

  const dependentPackages = useDependentPackages(packageId)
  const maxis = useStore(store => store.maxis)
  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useCurrentVariant(packageId)

  const tabs = packageViewTabs.filter(tab => tab.condition(variantInfo, dependentPackages, maxis))
  const labels = tabs.map(tab => tab.label(t, variantInfo, packageInfo, dependentPackages, maxis))
  const labelTags = tabs.map(tab => tab.labelTag?.(variantInfo))

  if (tabs.length === 0) {
    return null
  }

  const currentTab = tabs.find(tab => tab.id === activeTab) ?? tabs[0]

  return (
    <TabContext value={currentTab.id}>
      <Box borderBottom={1} borderColor="divider">
        <TabList onChange={(event, value) => actions.setPackageViewTab(value)}>
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
          key={`${variantInfo.id}/${id}`}
          sx={{
            height: "100%",
            overflowY: fullsize ? "hidden" : "auto",
            padding: fullsize ? 0 : 2,
          }}
          value={id}
        >
          <Suspense fallback={<Loader />}>
            <Component packageId={packageId} />
          </Suspense>
        </TabPanel>
      ))}
    </TabContext>
  )
}
