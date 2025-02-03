import { Folder as OpenLocationIcon, Archive as RemoveIcon } from "@mui/icons-material"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { DBPFInfo } from "@common/dbpf"
import type { PluginsFileInfo } from "@common/plugins"
import { FileListItem } from "@components/File/FileListItem"
import {
  loadPluginFileEntries,
  loadPluginFileEntry,
  openPluginFolder,
  patchPluginFileEntries,
  removePluginFile,
} from "@stores/actions"
import { Page } from "@utils/navigation"
import { usePluginsFileBanners } from "./utils"

export interface File {
  file: PluginsFileInfo
  name: string
  type: "file"
}

export function PluginsFileListItem({
  file,
  name,
  parent,
}: {
  file: PluginsFileInfo
  name: string
  parent?: string
}): JSX.Element {
  const [fileData, setFileData] = useState<DBPFInfo>()

  const { t } = useTranslation("Plugins")

  const path = parent ? `${parent}/${name}` : name
  const banners = usePluginsFileBanners(file, path)

  return (
    <FileListItem
      actions={[
        {
          description: t("actions.removeFile.description"),
          icon: RemoveIcon,
          onClick: () => removePluginFile(path),
        },

        {
          description: t("actions.openFileLocation.description"),
          icon: OpenLocationIcon,
          onClick: () => openPluginFolder(parent),
        },
      ]}
      banners={banners}
      dbpf={{
        fileData,
        loadEntries: () => loadPluginFileEntries(path),
        loadEntry: entryId => loadPluginFileEntry(path, entryId),
        patchFile: patch => patchPluginFileEntries(path, patch),
        setFileData,
      }}
      hasIssues={!!file.issues}
      isLocal
      path={name}
      location={{ data: { path }, page: Page.Plugins }}
    />
  )
}
