import { TabContext, TabList, TabPanel } from "@mui/lab"
import { Box, Tab } from "@mui/material"
import { type ComponentType, Suspense } from "react"

import { FlexBox } from "@components/FlexBox"
import { Loader } from "@components/Loader"
import { PackageTag } from "@components/Tags/PackageTag"
import { type Store, useStore, useStoreActions } from "@utils/store"

import { mapDefined } from "@salinco/nice-utils"
import { useLocation } from "@utils/navigation"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import type { Tag } from "./Tags/utils"

export type TabInfo<T> = {
  component: ComponentType<Omit<T, "tabs">>
  id: string
  label: (t: TFunction<"Tabs">, count: number) => string
  labelTag?: (props: Omit<T, "tabs">, store: Store) => Tag | undefined
  condition?: (props: Omit<T, "tabs">, store: Store) => boolean
  count?: (props: Omit<T, "tabs">, store: Store) => number
  fullsize?: boolean
}

export function Tabs<T>({ tabs, ...props }: T & { tabs: TabInfo<T>[] }): JSX.Element | null {
  const actions = useStoreActions()
  const location = useLocation()

  const { t } = useTranslation("Tabs")

  const activeTab = useStore(store => store.views[location.page]?.activeTab)

  const filteredTabs = useStore(store =>
    mapDefined(tabs, tab => {
      const count = tab.count?.(props, store)
      const isEnabled = tab.condition ? tab.condition(props, store) : count !== 0

      if (isEnabled) {
        return {
          ...tab,
          label: tab.label(t, count ?? 0),
          labelTag: tab.labelTag?.(props, store),
        }
      }
    }),
  )

  if (filteredTabs.length === 0) {
    return null
  }

  const currentTab = filteredTabs.find(tab => tab.id === activeTab) ?? filteredTabs[0]
  const pageId = JSON.stringify(location)

  return (
    <TabContext value={currentTab.id}>
      <FlexBox direction="column" height="100%">
        <Box borderBottom={1} borderColor="divider">
          <TabList onChange={(_event, value) => actions.setActiveTab(location.page, value)}>
            {filteredTabs.map(({ id, label, labelTag }) => (
              <Tab
                key={`${pageId}:${id}`}
                label={
                  <FlexBox alignItems="center" gap={1}>
                    {label}
                    {labelTag && <PackageTag dense {...labelTag} />}
                  </FlexBox>
                }
                value={id}
              />
            ))}
          </TabList>
        </Box>
        {filteredTabs.map(({ component: Component, fullsize, id }) => (
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
      </FlexBox>
    </TabContext>
  )
}
