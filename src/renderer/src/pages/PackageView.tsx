import { ComponentType, useEffect, useState } from "react"

import BackIcon from "@mui/icons-material/ArrowBack"
import TabContext from "@mui/lab/TabContext"
import TabList from "@mui/lab/TabList"
import TabPanel from "@mui/lab/TabPanel"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import Tab from "@mui/material/Tab"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import { create as createStore } from "zustand"

import { PackageInfo } from "@common/types"
import { PackageActions } from "@renderer/components/PackageActions"
import { PackageListItem } from "@renderer/components/PackageListItem"
import { PackageTags } from "@renderer/components/PackageTags"
import { history } from "@renderer/stores/navigation"
import { usePackageInfo, useStore, useStoreActions } from "@renderer/utils/store"

import { Loading } from "./Loading"

function PackageViewDependencies({ info }: { info: PackageInfo }): JSX.Element {
  const variantInfo = info.variants[info.status.variant]

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo?.dependencies.map((dependencyId, index) => (
        <PackageListItem key={dependencyId} index={index} item={dependencyId} />
      ))}
    </List>
  )
}

function PackageViewDocumentation({ info }: { info: PackageInfo }): JSX.Element {
  const actions = useStoreActions()
  const [html, setHtml] = useState<string>()

  useEffect(() => {
    actions.getPackageDocsAsHtml(info.id).then(setHtml).catch(console.error)
  }, [actions, info.id])

  if (!html) {
    return <Loading />
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} style={{ height: "100%" }} />
}

function PackageViewFiles({ info }: { info: PackageInfo }): JSX.Element {
  const variantInfo = info.variants[info.status.variant]

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
    id: "dependencies",
    component: PackageViewDependencies,
    condition(info) {
      const variant = info.variants[info.status.variant]
      return !!variant?.dependencies.length
    },
    name(info) {
      const variant = info.variants[info.status.variant]
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
      const variant = info.variants[info.status.variant]
      return !!variant?.files?.length
    },
    name(info) {
      const variant = info.variants[info.status.variant]
      return `${variant?.files?.length ?? 0} files`
    },
  },
  {
    id: "docs",
    component: PackageViewDocumentation,
    condition(info) {
      return !!info.docs
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

  if (!packageInfo) {
    return null
  }

  const variantInfo = packageInfo.variants[packageInfo.status.variant]

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
            {packageInfo.id}#{packageInfo.status.variant}
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
