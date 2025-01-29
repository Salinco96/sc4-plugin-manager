import {
  Folder as FolderIcon,
  Sync as ReloadIcon,
  Archive as RemoveIcon,
} from "@mui/icons-material"
import { Button } from "@mui/material"
import { forEach, sortBy, values } from "@salinco/nice-utils"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { Plugins } from "@common/plugins"
import { Empty } from "@components/Empty"
import { FlexCol, FlexRow } from "@components/FlexBox"
import { List } from "@components/List"
import { ToolButton } from "@components/ToolButton"
import { openPluginFolder, reloadPlugins, removePluginFile } from "@stores/actions"

import { useNavigation } from "@utils/navigation"
import { PluginsBreadcrumbs } from "./PluginsBreadcrumbs"
import { type File, PluginsFileListItem } from "./PluginsFileListItem"
import { type Folder, PluginsFolderListItem } from "./PluginsFolderListItem"

export function PluginsFolder({
  path,
  plugins,
}: {
  path?: string
  plugins: Plugins
}): JSX.Element {
  const { openPluginsView } = useNavigation()
  const { t } = useTranslation("Plugins")

  const parentPath = path?.split("/").slice(0, -1).join("/") || undefined

  const contents = useMemo(() => {
    const files: { [name in string]?: File } = {}
    const folders: { [name in string]?: Folder } = {}
    const prefix = path ? `${path}/` : ""

    forEach(plugins, (file, path) => {
      if (path.startsWith(prefix)) {
        const [name, ...rest] = path.slice(prefix.length).split("/")
        if (rest.length) {
          folders[name] ??= { files: [], name, type: "folder" }
          folders[name].files.push(file)
          if (file.issues) {
            folders[name].hasIssues = true
          }
        } else {
          files[name] = { file, name, type: "file" }
        }
      }
    })

    return [
      ...sortBy(values(folders), folder => folder.name),
      ...sortBy(values(files), folder => folder.name),
    ]
  }, [path, plugins])

  return (
    <>
      <FlexRow centered gap={1} pt={2} px={2}>
        <PluginsBreadcrumbs path={path} />
        {(!path || !!contents.length) && (
          <FlexRow gap={0.5}>
            <ToolButton
              description={t("actions.openFolder.description")}
              icon={FolderIcon}
              onClick={() => openPluginFolder(path)}
            />

            {path && (
              <ToolButton
                description={t("actions.removeFolder.description")}
                icon={RemoveIcon}
                onClick={() => {
                  removePluginFile(path)
                  openPluginsView(parentPath)
                }}
              />
            )}

            <ToolButton
              description={t("actions.reloadPlugins.description")}
              icon={ReloadIcon}
              onClick={reloadPlugins}
            />
          </FlexRow>
        )}
      </FlexRow>

      {contents.length ? (
        <FlexCol fullHeight>
          <List
            items={contents}
            renderItem={item =>
              item.type === "file" ? (
                <PluginsFileListItem {...item} parent={path} />
              ) : (
                <PluginsFolderListItem {...item} parent={path} />
              )
            }
          />
        </FlexCol>
      ) : (
        <Empty message={t(path ? "missing" : "empty")}>
          <Button onClick={reloadPlugins} title={t("actions.reloadPlugins.description")}>
            {t("actions.reloadPlugins.label")}
          </Button>
        </Empty>
      )}
    </>
  )
}
