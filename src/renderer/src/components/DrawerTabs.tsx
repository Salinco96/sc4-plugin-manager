import { Fragment, useCallback, useMemo, useState } from "react"

import { ExpandLess as CollapseIcon, ExpandMore as ExpandIcon } from "@mui/icons-material"
import {
  Badge,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Tooltip,
} from "@mui/material"

import { entries, keys } from "@common/utils/objects"
import { Page, useHistory, useLocation } from "@utils/navigation"
import { useStore, useStoreActions } from "@utils/store"
import { type TabInfo, tabs } from "@utils/tabs"

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

const groupedTabs = tabs.reduce(
  (result, tab) => {
    const group = tab.group ?? ""
    result[group] ??= []
    const groupTabs = result[group]
    groupTabs.push(tab)
    return result
  },
  {} as { [group in string]?: TabInfo[] },
)

export function DrawerTabs(): JSX.Element {
  const packageFilters = useStore(store => store.packageFilters)
  const { page } = useLocation()

  const [expandedGroups, setExpandedGroups] = useState<{ [group in string]?: boolean }>({
    Packages: true,
  })

  const activeTabId = useMemo(() => {
    switch (page) {
      case Page.Authors:
        return "authors"

      case Page.Packages: {
        if (packageFilters.onlyErrors) {
          return "packages:errors"
        }

        if (packageFilters.onlyNew) {
          return "packages:new"
        }

        if (packageFilters.onlyUpdates) {
          return "packages:updates"
        }

        if (packageFilters.categories.length === 1) {
          const id = `packages:${packageFilters.categories[0]}`
          if (tabs.some(tab => tab.id === id)) {
            return id
          }
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
      {entries(groupedTabs).map(([group, tabs], index) => {
        const collapsable = tabs.some(tab => tab.collapse)
        const collapsed = !!group && !expandedGroups[group]

        const visibleTabs = tabs.filter(tab => !tab.collapse || !collapsed)
        const isEmpty = !visibleTabs.length
        const isLast = index === keys(groupedTabs).length - 1

        return (
          <Fragment key={group}>
            {!!group && (
              <ListSubheader
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingRight: 1,
                }}
              >
                {group}
                {collapsable && (
                  <IconButton
                    onClick={() => {
                      setExpandedGroups({
                        ...expandedGroups,
                        [group]: collapsed,
                      })
                    }}
                    size="small"
                  >
                    {collapsed ? (
                      <ExpandIcon fontSize="small" />
                    ) : (
                      <CollapseIcon fontSize="small" />
                    )}
                  </IconButton>
                )}
              </ListSubheader>
            )}
            {visibleTabs.map(tab => {
              const isActive = tab.id === activeTabId

              return (
                <ListItem dense disablePadding key={tab.id}>
                  <Tab isActive={isActive} tab={tab} />
                </ListItem>
              )
            })}
            {!isLast && <Divider sx={{ marginTop: isEmpty ? 0 : 2 }} />}
          </Fragment>
        )
      })}
    </List>
  )
}
