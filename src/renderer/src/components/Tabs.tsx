import { TabContext, TabList, TabPanel } from "@mui/lab"
import { Box, Tab } from "@mui/material"
import { mapDefined } from "@salinco/nice-utils"
import type { TFunction } from "i18next"
import { type ComponentType, Suspense } from "react"
import { useTranslation } from "react-i18next"

import { FlexCol, FlexRow } from "@components/FlexBox"
import { Loader } from "@components/Loader"
import { useLocation } from "@utils/navigation"
import { type Store, useStore, useStoreActions } from "@utils/store"

import { Tag } from "./Tags/Tag"
import type { TagInfo } from "./Tags/utils"

export type TabInfo<T> = {
  component: ComponentType<Omit<T, "tabs">>
  id: string
  label: (t: TFunction<"Tabs">, count?: number) => string
  labelTag?: (props: Omit<T, "tabs">, store: Store) => TagInfo | undefined
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
      const isEnabled = tab.condition?.(props, store) ?? count !== 0

      if (isEnabled) {
        return {
          ...tab,
          label: tab.label(t, count),
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
      <FlexCol fullHeight>
        <Box borderBottom={1} borderColor="divider">
          <TabList
            onChange={(_e, value) =>
              actions.setView(location.page, { activeTab: value, elementId: undefined })
            }
          >
            {filteredTabs.map(({ id, label, labelTag }) => (
              <Tab
                key={`${pageId}:${id}`}
                label={
                  <FlexRow centered gap={1}>
                    {label}
                    {labelTag && <Tag dense tag={labelTag} />}
                  </FlexRow>
                }
                value={id}
              />
            ))}
          </TabList>
        </Box>

        <FlexRow flex="1 1 0" fullWidth overflow="auto">
          {filteredTabs.map(({ component: Component, fullsize, id }) => (
            <TabPanel
              key={`${pageId}:${id}`}
              sx={{ p: fullsize ? 0 : 2, width: "100%" }}
              value={id}
            >
              <Suspense fallback={<Loader />}>
                <Component {...props} />
              </Suspense>
            </TabPanel>
          ))}
        </FlexRow>
      </FlexCol>
    </TabContext>
  )
}
