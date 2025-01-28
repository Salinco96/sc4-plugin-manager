import type { DBPFFile as DBPFFileType } from "@common/dbpf"
import type { FileContentsInfo } from "@common/variants"
import { DBPFFile } from "@components/DBPF/DBPFFile"
import {
  loadPluginFileEntries,
  loadPluginFileEntry,
  openPluginFolder,
  patchPluginFileEntries,
} from "@stores/actions"
import { Page } from "@utils/navigation"
import { useState } from "react"

export interface File {
  contents: FileContentsInfo
  name: string
  type: "file"
}

export function FileListItem({ file, path }: { file: File; path?: string }): JSX.Element {
  const [fileData, setFileData] = useState<DBPFFileType>()

  const pluginPath = path ? `${path}/${file.name}` : file.name

  return (
    <DBPFFile
      fileData={fileData}
      filePath={file.name}
      isLocal
      loadEntries={async () => {
        setFileData(await loadPluginFileEntries(pluginPath))
      }}
      loadEntry={async entryId => {
        const entry = await loadPluginFileEntry(pluginPath, entryId)
        setFileData(
          data =>
            data && {
              ...data,
              entries: {
                ...data.entries,
                [entryId]: entry,
              },
            },
        )
      }}
      location={{ data: { path: pluginPath }, page: Page.Plugins }}
      onPatch={async patch => {
        setFileData(await patchPluginFileEntries(pluginPath, patch))
      }}
      openFileLocation={() => openPluginFolder(path)}
    />
  )

  // return (
  //   <ListItem
  //     header={Header}
  //     location={{
  //       data: { path: path ? `${path}/${file.name}` : file.name },
  //       page: Page.Plugins,
  //     }}
  //     icon={FileIcon}
  //     subtitle="File" // todo
  //     title={file.name}
  //   />
  // )
}
