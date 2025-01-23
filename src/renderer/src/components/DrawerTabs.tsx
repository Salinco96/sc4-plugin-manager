import {
  ExpandLess as CollapseIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandIcon,
} from "@mui/icons-material"
import {
  Badge,
  Box,
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
import { entries, keys } from "@salinco/nice-utils"
import { Fragment, useCallback, useMemo, useState } from "react"

import { Page, useHistory, useLocation } from "@utils/navigation"
import { type TabInfo, tabs } from "@utils/tabs"

import { setPackageFilters } from "@stores/actions"
import { store } from "@stores/main"
import { FlexRow } from "./FlexBox"

const BadgeIcons = {
  error: ErrorIcon,
}

export function Tab({ isActive, tab }: { isActive: boolean; tab: TabInfo }): JSX.Element {
  // TODO: Bad!
  const badge = store.useStore(store => tab.badge?.(store))
  const history = useHistory()

  const setActiveTab = useCallback(
    (tab: TabInfo) => {
      if (!isActive) {
        history.replace(tab.location)
        if (tab.packageFilters) {
          setPackageFilters(tab.packageFilters)
        }
      }
    },
    [history, isActive],
  )

  const BadgeIcon = badge?.icon && BadgeIcons[badge.icon]

  const tooltip = (BadgeIcon && badge.label) ?? tab.tooltip

  const button = (
    <ListItemButton onClick={() => setActiveTab(tab)} selected={isActive}>
      <ListItemIcon sx={{ minWidth: 0, marginRight: 2 }}>{tab.icon}</ListItemIcon>
      <ListItemText primary={tab.label} />
      {badge && !BadgeIcon && (
        <Badge badgeContent={badge.label} color={badge.color} max={9999} sx={{ mr: 1 }} />
      )}
      {BadgeIcon && (
        <Box component="span" position="relative" mr={1}>
          <FlexRow
            centered
            position="absolute"
            right={0}
            top={0}
            sx={{ transform: "translate(50%, -50%)", transformOrigin: "100% 0%" }}
          >
            <BadgeIcon color={badge.color} />
          </FlexRow>
        </Box>
      )}
    </ListItemButton>
  )

  if (tooltip) {
    return (
      <Tooltip arrow placement="right" title={tooltip}>
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
  const { page } = useLocation()

  const packageFilters = store.usePackageFilters()

  const [expandedGroups, setExpandedGroups] = useState<{ [group in string]?: boolean }>({})

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

      case Page.Tools:
        return "tools"
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
