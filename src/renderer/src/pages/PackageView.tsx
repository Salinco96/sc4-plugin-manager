import { ComponentType, useEffect, useState } from "react"

import {
  ArrowBack as BackIcon,
  BedtimeOutlined as DeprecatedIcon,
  DoDisturb as IncompatibleIcon,
  ScienceOutlined as ExperimentalIcon,
  Update as UpdateIcon,
} from "@mui/icons-material"
import { TabContext, TabList, TabPanel } from "@mui/lab"
import { Box, IconButton, List, ListItem, Tab, Tooltip, Typography } from "@mui/material"
import { create as createStore } from "zustand"

import { getCategoryLabel } from "@common/categories"
import { PackageInfo } from "@common/types"
import { PackageActions } from "@renderer/components/PackageActions"
import { PackageListItem } from "@renderer/components/PackageListItem"
import { PackageListItemBanner } from "@renderer/components/PackageListItemBanner"
import { PackageTags } from "@renderer/components/PackageTags"
import { Text } from "@renderer/components/Text"
import { useHistory } from "@renderer/utils/navigation"
import { usePackageInfo, useStore, useStoreActions } from "@renderer/utils/store"

import { Loading } from "./Loading"

function PackageViewInfo({ info }: { info: PackageInfo }): JSX.Element {
  const variantInfo = info.variants[info.status.variantId]

  return (
    <Box>
      {variantInfo.description && (
        <Typography variant="body2">{variantInfo.description}</Typography>
      )}
      {/* TODO: Better formatting (with Simtropolis user links?) */}
      <Typography variant="body2">
        <b>Authors:</b> {variantInfo.authors.join(", ")}
      </Typography>
      {/* TODO: Better formatting */}
      <Typography variant="body2">
        <b>Category:</b> {getCategoryLabel(variantInfo.category)}
      </Typography>
      {/* TODO: Better formatting */}
      {variantInfo.url && (
        <Text maxLines={1} variant="body2">
          <b>Website:</b>{" "}
          <a href={variantInfo.url} target="_blank" rel="noreferrer">
            {variantInfo.url}
          </a>
        </Text>
      )}
      {/* TODO: Better formatting */}
      {variantInfo.conflictGroups && (
        <Typography variant="body2">
          <b>Conflict groups:</b> {variantInfo.conflictGroups.join(", ")}
        </Typography>
      )}
      {/* TODO: Better formatting */}
      {variantInfo.requirements && (
        <Typography variant="body2">
          <b>Requirements:</b>
          <ul>
            {Object.entries(variantInfo.requirements).map(([requirement, value]) => (
              <li key={requirement}>
                {requirement}: {String(value)}
              </li>
            ))}
          </ul>
        </Typography>
      )}
      {variantInfo.deprecated && (
        <PackageListItemBanner icon={<DeprecatedIcon />} color="experimental">
          <b>Legacy:</b> This package is no longer maintained or recommended.
        </PackageListItemBanner>
      )}
      {variantInfo.experimental && (
        <PackageListItemBanner icon={<ExperimentalIcon />} color="experimental">
          <b>Experimental:</b> This package should be used <b>for testing purposes only</b>.
        </PackageListItemBanner>
      )}
      {variantInfo.incompatible?.map(reason => (
        <PackageListItemBanner key={reason} icon={<IncompatibleIcon />} color="incompatible">
          <b>Incompatible:</b> {reason}
        </PackageListItemBanner>
      ))}
      {variantInfo.update && (
        <PackageListItemBanner icon={<UpdateIcon />}>
          <b>Outdated:</b> A new version of this package is available.
        </PackageListItemBanner>
      )}
      {variantInfo.conflictGroups?.map(groupId => (
        <PackageListItemBanner key={groupId}>{variantInfo.description}</PackageListItemBanner>
      ))}
    </Box>
  )
}

function PackageViewDependencies({ info }: { info: PackageInfo }): JSX.Element {
  const variantInfo = info.variants[info.status.variantId]

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo?.dependencies?.map((dependencyId, index) => (
        <PackageListItem key={dependencyId} index={index} item={dependencyId} />
      ))}
    </List>
  )
}

function PackageViewDocumentation({ info }: { info: PackageInfo }): JSX.Element {
  const actions = useStoreActions()
  const [html, setHtml] = useState<string>()

  useEffect(() => {
    actions.getPackageDocsAsHtml(info.id, info.status.variantId).then(setHtml).catch(console.error)
  }, [actions, info.id])

  if (!html) {
    return <Loading />
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} style={{ height: "100%" }} />
}

function PackageViewFiles({ info }: { info: PackageInfo }): JSX.Element {
  const variantInfo = info.variants[info.status.variantId]

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo?.files?.map(file => (
        <ListItem
          key={file.path}
          onClick={() => {
            useStore
              .getState()
              .actions.openPackageFileInExplorer(info.id, variantInfo.id, file.path)
          }}
        >
          {file.path}
        </ListItem>
      ))}
    </List>
  )
}

function PackageViewRequiredBy({ info }: { info: PackageInfo }): JSX.Element {
  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {info.status.requiredBy?.map((dependencyId, index) => (
        <PackageListItem key={dependencyId} index={index} item={dependencyId} />
      ))}
    </List>
  )
}

const packageViewTabs: {
  component: ComponentType<{ info: PackageInfo }>
  id: string
  name: (info: PackageInfo) => string
  condition?: (info: PackageInfo) => boolean
  fullsize?: boolean
}[] = [
  {
    id: "info",
    component: PackageViewInfo,
    condition(info) {
      const variant = info.variants[info.status.variantId]
      return !!variant
    },
    name() {
      return "Summary"
    },
  },
  {
    id: "dependencies",
    component: PackageViewDependencies,
    condition(info) {
      const variant = info.variants[info.status.variantId]
      return !!variant?.dependencies?.length
    },
    name(info) {
      const variant = info.variants[info.status.variantId]
      return `${variant?.dependencies?.length ?? 0} dependencies`
    },
  },
  {
    id: "requires",
    component: PackageViewRequiredBy,
    condition(info) {
      return !!info.status.requiredBy?.length
    },
    name() {
      return "Required by"
    },
  },
  {
    id: "files",
    component: PackageViewFiles,
    condition(info) {
      const variant = info.variants[info.status.variantId]
      return !!variant?.files?.length
    },
    name(info) {
      const variant = info.variants[info.status.variantId]
      return `${variant?.files?.length ?? 0} files`
    },
  },
  {
    id: "docs",
    component: PackageViewDocumentation,
    condition(info) {
      const variant = info.variants[info.status.variantId]
      return !!variant.docs?.path
    },
    name() {
      return "Readme"
    },
    fullsize: true,
  },
]

const usePackageViewTab = createStore<{
  activeTab: string
  setActiveTab(tabId: string): void
}>()(set => ({
  activeTab: packageViewTabs[0].id,
  setActiveTab(tabId) {
    set({ activeTab: tabId })
  },
}))

function PackageView({ packageId }: { packageId: string }): JSX.Element | null {
  const { activeTab, setActiveTab } = usePackageViewTab()
  const packageInfo = usePackageInfo(packageId)
  const history = useHistory()

  if (!packageInfo) {
    return null
  }

  const variantInfo = packageInfo.variants[packageInfo.status.variantId]

  if (!variantInfo) {
    return null
  }

  const tabs = packageViewTabs.filter(tab => !tab.condition || tab.condition(packageInfo))

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", paddingTop: 1 }}>
      <Tooltip arrow placement="right" title="Go back">
        <IconButton
          aria-label="Go back"
          color="inherit"
          onClick={() => history.back()}
          size="small"
          sx={{ alignSelf: "flex-start", marginLeft: 1 }}
        >
          <BackIcon />
        </IconButton>
      </Tooltip>
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          paddingLeft: 2,
          paddingRight: 2,
          paddingBottom: 2,
        }}
      >
        <Box sx={{ flexGrow: 1, paddingRight: 2 }}>
          <Typography variant="h6">
            {packageInfo.name} (v{variantInfo.installed ?? variantInfo.version})
          </Typography>
          <Typography variant="body2">
            {packageInfo.id}#{packageInfo.status.variantId}
          </Typography>
          <PackageTags packageInfo={packageInfo} />
        </Box>
        <PackageActions packageInfo={packageInfo} />
      </Box>

      {tabs.length > 0 && (
        <TabContext value={(tabs.find(tab => tab.id === activeTab) ?? tabs[0])?.id ?? activeTab}>
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <TabList onChange={(_, value) => setActiveTab(value)}>
              {tabs.map(tab => (
                <Tab key={tab.id} label={tab.name(packageInfo)} value={tab.id} />
              ))}
            </TabList>
          </Box>
          {tabs.map(({ component: Component, fullsize, id }) => (
            <TabPanel
              key={id}
              sx={{
                height: "100%",
                overflowY: fullsize ? "hidden" : "auto",
                padding: fullsize ? 0 : 2,
              }}
              value={id}
            >
              <Component info={packageInfo} />
            </TabPanel>
          ))}
        </TabContext>
      )}
    </Box>
  )
}

export default PackageView
