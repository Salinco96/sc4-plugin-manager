import { Fragment, useCallback, useMemo } from "react"

import {
  Badge,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Tooltip,
} from "@mui/material"

import { Page } from "@renderer/pages"
import { TabInfo, tabs } from "@renderer/tabs"
import { useHistory, useLocation } from "@renderer/utils/navigation"
import { useStore, useStoreActions } from "@renderer/utils/store"

import { TagType, parseTag } from "./PackageList/utils"

export function Tab({ isActive, tab }: { isActive: boolean; tab: TabInfo }): JSX.Element {
  const actions = useStoreActions()
  const count = useStore(store => tab.badgeCount?.(store) ?? 0)
  const history = useHistory()

  const setActiveTab = useCallback(
    (tab: TabInfo) => {
      if (!isActive) {
        history.replace(tab.location)
        if (tab.packageFilters) {
          actions.setPackageFilters(tab.packageFilters)
        }
      }
    },
    [actions, history, isActive],
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
      case Page.Packages: {
        if (packageFilters.onlyErrors) {
          return "packages:errors"
        }

        if (packageFilters.onlyUpdates) {
          return "packages:updates"
        }

        const tags = packageFilters.tags.map(parseTag)
        const categoryTags = tags.filter(tag => tag.type === TagType.CATEGORY)
        if (categoryTags.length === 1) {
          return `packages:${categoryTags[0].value}`
        }

        return "packages:all"
      }

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
