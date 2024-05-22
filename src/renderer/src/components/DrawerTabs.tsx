import { Fragment, useCallback, useMemo } from "react"

import Divider from "@mui/material/Divider"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import ListSubheader from "@mui/material/ListSubheader"
import Tooltip from "@mui/material/Tooltip"

import { PackageState } from "@common/types"
import { Page } from "@renderer/pages"
import { history, useLocation } from "@renderer/stores/navigation"
import { TabInfo, tabs } from "@renderer/tabs"
import { useStore, useStoreActions } from "@renderer/utils/store"

export function DrawerTabs(): JSX.Element {
  const actions = useStoreActions()
  const packageFilters = useStore(store => store.packageFilters)
  const { page } = useLocation()

  const activeTabId = useMemo(() => {
    switch (page) {
      case Page.Packages:
        if (packageFilters.categories.length === 1) {
          return `packages:${packageFilters.categories[0]}`
        }

        if (packageFilters.states.includes(PackageState.ERROR)) {
          return "packages:errors"
        }

        return "packages:all"
      case Page.Profile:
        return "profile"
      case Page.Settings:
        return "settings"
    }
  }, [packageFilters, page])

  const setActiveTab = useCallback(
    (tab: TabInfo) => {
      if (activeTabId !== tab.id) {
        history.replace(tab.location)
        if (tab.packageFilters) {
          actions.setPackageFilters(tab.packageFilters)
        }
      }
    },
    [actions, activeTabId],
  )

  return (
    <List component="nav" sx={{ overflowY: "auto" }}>
      {tabs.map((tab, index) => {
        const previousTab = tabs[index - 1]
        const isActive = tab.id === activeTabId
        const isNewGroup = previousTab?.group !== tab.group

        const button = (
          <ListItemButton onClick={() => setActiveTab(tab)} selected={isActive}>
            <ListItemIcon sx={{ minWidth: 0, marginRight: 2 }}>{tab.icon}</ListItemIcon>
            <ListItemText primary={tab.label} />
          </ListItemButton>
        )

        return (
          <Fragment key={tab.id + String(Math.random())}>
            {isNewGroup && previousTab && <Divider sx={{ marginTop: 2 }} />}
            {isNewGroup && <ListSubheader>{tab.group}</ListSubheader>}
            <ListItem dense disablePadding>
              {tab.tooltip ? (
                <Tooltip arrow placement="right" title={tab.tooltip}>
                  {button}
                </Tooltip>
              ) : (
                button
              )}
            </ListItem>
          </Fragment>
        )
      })}
    </List>
  )
}
