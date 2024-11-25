import { FlexBox } from "@components/FlexBox"
import { PackageTag } from "@components/Tags/PackageTag"
import { TabContext, TabList, TabPanel } from "@mui/lab"
import { Box, Tab } from "@mui/material"
import { useCurrentVariant, useDependentPackages, usePackageInfo } from "@utils/packages"
import { useTranslation } from "react-i18next"

import { ErrorBoundary } from "@components/ErrorBoundary"
import { Loader } from "@components/Loader"
import { Suspense } from "react"
import { ContentErrorComponent } from "../../Content"
import { type PackageViewTabInfoProps, packageViewTabs, usePackageViewTab } from "./tabs"

export function PackageViewTabs({ packageId }: PackageViewTabInfoProps): JSX.Element | null {
  const { activeTab, setActiveTab } = usePackageViewTab()
  const { t } = useTranslation("PackageViewTabs")

  const dependentPackages = useDependentPackages(packageId)
  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useCurrentVariant(packageId)

  const tabs = packageViewTabs.filter(tab => tab.condition(variantInfo, dependentPackages))
  const labels = tabs.map(tab => tab.label(t, variantInfo, packageInfo, dependentPackages))
  const labelTags = tabs.map(tab => tab.labelTag?.(variantInfo))

  if (tabs.length === 0) {
    return null
  }

  const currentTab = tabs.find(tab => tab.id === activeTab) ?? tabs[0]

  return (
    <TabContext value={currentTab.id}>
      <Box borderBottom={1} borderColor="divider">
        <TabList onChange={(event, value) => setActiveTab(value)}>
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
            <ErrorBoundary ErrorComponent={ContentErrorComponent}>
              <Component packageId={packageId} />
            </ErrorBoundary>
          </Suspense>
        </TabPanel>
      ))}
    </TabContext>
  )
}
