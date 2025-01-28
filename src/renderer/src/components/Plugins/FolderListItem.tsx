import { Header } from "@components/Header"
import { ListItem } from "@components/ListItem"
import { ToolButton } from "@components/ToolButton"
import { Folder as FolderIcon, Folder as OpenLocationIcon } from "@mui/icons-material"
import { openPluginFolder } from "@stores/actions"
import { Page } from "@utils/navigation"
import { useTranslation } from "react-i18next"

export interface Folder {
  children: string[]
  name: string
  type: "folder"
}

export function FolderListItem({ folder, path }: { folder: Folder; path?: string }): JSX.Element {
  const pluginPath = path ? `${path}/${folder.name}` : folder.name

  const { t } = useTranslation("PackageViewFiles")

  return (
    <ListItem
      actions={
        <ToolButton
          description={t("openFolder")}
          icon={OpenLocationIcon}
          onClick={() => openPluginFolder(pluginPath)}
        />
      }
      compact
      header={Header}
      location={{ data: { path: pluginPath }, page: Page.Plugins }}
      icon={FolderIcon}
      subtitle={`${folder.children.length} file(s)`}
      title={folder.name}
    />
  )
}
