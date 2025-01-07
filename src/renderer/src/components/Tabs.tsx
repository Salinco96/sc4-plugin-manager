import { TabContext, TabList, TabPanel } from "@mui/lab"
import { Box, Tab } from "@mui/material"
import { type ComponentType, Suspense } from "react"

import { FlexBox } from "@components/FlexBox"
import { Loader } from "@components/Loader"
import { PackageTag } from "@components/Tags/PackageTag"
import { type Store, useStore, useStoreActions } from "@utils/store"

import { useLocation } from "@utils/navigation"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import type { Tag } from "./Tags/utils"

export type TabInfo<T> = {
  component: ComponentType<Omit<T, "tabs">>
  id: string
  label: (t: TFunction<"Tabs">, props: Omit<T, "tabs">, store: Store) => string
  labelTag?: (props: Omit<T, "tabs">, store: Store) => Tag | undefined
  condition: (props: Omit<T, "tabs">, store: Store) => boolean
  fullsize?: boolean
}

export function Tabs<T>({ tabs, ...props }: T & { tabs: TabInfo<T>[] }): JSX.Element | null {
  const actions = useStoreActions()
  const location = useLocation()

  const { t } = useTranslation("Tabs")

  const activeTab = useStore(store => store.views[location.page]?.activeTab)
  const enabledTabs = useStore(store => tabs.filter(tab => tab.condition(props, store)))
  const labels = useStore(store => enabledTabs.map(tab => tab.label(t, props, store)))
  const labelTags = useStore(store => enabledTabs.map(tab => tab.labelTag?.(props, store)))

  if (enabledTabs.length === 0) {
    return null
  }

  const currentTab = enabledTabs.find(tab => tab.id === activeTab) ?? enabledTabs[0]
  const pageId = JSON.stringify(location)

  return (
    <TabContext value={currentTab.id}>
      <Box borderBottom={1} borderColor="divider">
        <TabList onChange={(_event, value) => actions.setActiveTab(location.page, value)}>
          {enabledTabs.map((tab, index) => (
            <Tab
              key={`${pageId}:${tab.id}`}
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
      {enabledTabs.map(({ component: Component, fullsize, id }) => (
        <TabPanel
          key={`${pageId}:${id}`}
          sx={{
            height: "100%",
            overflowY: fullsize ? "hidden" : "auto",
            padding: fullsize ? 0 : 2,
          }}
          value={id}
        >
          <Suspense fallback={<Loader />}>
            <Component {...props} />
          </Suspense>
        </TabPanel>
      ))}
    </TabContext>
  )
}
