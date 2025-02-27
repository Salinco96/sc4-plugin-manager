import { Folder as FolderIcon, Error as WarningIcon } from "@mui/icons-material"
import { useTranslation } from "react-i18next"

import type { PluginsFileInfo } from "@common/plugins"
import { Header } from "@components/Header"
import { ListItem } from "@components/ListItem"
import { ToolButton } from "@components/ToolButton"
import { openPluginDirectory } from "@stores/actions"
import { Page } from "@utils/navigation"

export interface Folder {
  hasIssues?: boolean
  files: PluginsFileInfo[]
  name: string
  type: "folder"
}

export function PluginsFolderListItem({
  files,
  hasIssues,
  name,
  parent,
}: {
  files: PluginsFileInfo[]
  hasIssues?: boolean
  name: string
  parent?: string
}): JSX.Element {
  const { t } = useTranslation("Plugins")

  const path = parent ? `${parent}/${name}` : name

  return (
    <ListItem
      actions={
        <ToolButton
          description={t("actions.openFolder.description")}
          icon={FolderIcon}
          onClick={() => openPluginDirectory(path)}
        />
      }
      compact
      header={Header}
      icon={hasIssues ? WarningIcon : FolderIcon}
      iconColor={hasIssues ? "warning" : undefined}
      location={{ data: { path }, page: Page.Plugins }}
      subtitle={t("files", { count: files.length })}
      title={name}
    />
  )
}
