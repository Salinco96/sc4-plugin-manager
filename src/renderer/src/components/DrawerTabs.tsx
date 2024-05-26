import { Fragment, useCallback, useMemo } from "react"

import { Badge } from "@mui/material"
import Divider from "@mui/material/Divider"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import ListSubheader from "@mui/material/ListSubheader"
import Tooltip from "@mui/material/Tooltip"

import { Page } from "@renderer/pages"
import { history, useLocation } from "@renderer/stores/navigation"
import { TabInfo, tabs } from "@renderer/tabs"
import { useStore, useStoreActions } from "@renderer/utils/store"

export function Tab({ isActive, tab }: { isActive: boolean; tab: TabInfo }): JSX.Element {
  const actions = useStoreActions()
  const count = useStore(store => tab.badgeCount?.(store) ?? 0)

  const setActiveTab = useCallback(
    (tab: TabInfo) => {
      if (!isActive) {
        history.replace(tab.location)
        if (tab.packageFilters) {
          actions.setPackageFilters(tab.packageFilters)
        }
      }
    },
    [actions, isActive],
  )

  const button = (
    <ListItemButton onClick={() => setActiveTab(tab)} selected={isActive}>
      <ListItemIcon sx={{ minWidth: 0, marginRight: 2 }}>{tab.icon}</ListItemIcon>
      <ListItemText primary={tab.label} />
      <Badge badgeContent={count} color={tab.badgeColor} max={9999} sx={{ marginRight: 1 }} />
    </ListItemButton>
  )

  if (tab.tooltip) {
    return (
      <Tooltip arrow placement="right" title={tab.tooltip}>
        {button}
      </Tooltip>
    )
  }

  return button
}

export function DrawerTabs(): JSX.Element {
  const packageFilters = useStore(store => store.packageFilters)
  const { page } = useLocation()

  const activeTabId = useMemo(() => {
    switch (page) {
      case Page.Packages:
        if (packageFilters.onlyErrors) {
          return "packages:errors"
        }

        if (packageFilters.onlyUpdates) {
          return "packages:updates"
        }

        if (packageFilters.categories.length === 1) {
          return `packages:${packageFilters.categories[0]}`
        }

        return "packages:all"
      case Page.Profile:
        return "profile"
      case Page.Settings:
        return "settings"
    }
  }, [packageFilters, page])

  return (
    <List component="nav" sx={{ overflowY: "auto" }}>
      {tabs.map((tab, index) => {
        const previousTab = tabs[index - 1]
        const isActive = tab.id === activeTabId
        const isNewGroup = previousTab?.group !== tab.group

        return (
          <Fragment key={tab.id}>
            {isNewGroup && previousTab && <Divider sx={{ marginTop: 2 }} />}
            {isNewGroup && <ListSubheader>{tab.group}</ListSubheader>}
            <ListItem dense disablePadding>
              <Tab isActive={isActive} tab={tab} />
            </ListItem>
          </Fragment>
        )
      })}
    </List>
  )
}
