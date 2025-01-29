import { Folder as FolderIcon, Archive as RemoveIcon } from "@mui/icons-material"
import { size } from "@salinco/nice-utils"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { type DBPFFile, isDBPF } from "@common/dbpf"
import type { PluginsFileInfo } from "@common/plugins"
import { FlexCol, FlexRow } from "@components/FlexBox"
import { type TabInfo, Tabs } from "@components/Tabs"
import { ToolButton } from "@components/ToolButton"
import { loadPluginFileEntries, openPluginFolder, removePluginFile } from "@stores/actions"
import { useNavigation } from "@utils/navigation"

import { Banners } from "@components/Banners"
import { PluginsBreadcrumbs } from "./PluginsBreadcrumbs"
import { PluginsFileEntries } from "./PluginsFileEntries"
import { usePluginsFileBanners } from "./utils"

const tabs: TabInfo<{ data?: DBPFFile; file: PluginsFileInfo; path: string }>[] = [
  {
    id: "entries",
    component: PluginsFileEntries,
    condition({ path }) {
      return isDBPF(path)
    },
    count({ data }) {
      return data ? size(data.entries) : 0
    },
    label(t, count) {
      return t("entries", { count })
    },
  },
  // {
  //   id: "logs",
  //   component: PluginsFileLogs,
  //   condition({ file }) {
  //     return !!file.logs
  //   },
  //   label(t) {
  //     return t("logs")
  //   },
  // },
]

export function PluginsFile({
  file,
  path,
}: {
  file: PluginsFileInfo
  path: string
}): JSX.Element {
  const [fileData, setFileData] = useState<DBPFFile>()

  const { openPluginsView } = useNavigation()
  const { t } = useTranslation("Plugins")

  const banners = usePluginsFileBanners(file, path)
  const parentPath = path.split("/").slice(0, -1).join("/") || undefined

  useEffect(() => {
    if (isDBPF(path)) {
      loadPluginFileEntries(path).then(setFileData)
    } else {
      setFileData(undefined)
    }
  }, [path])

  return (
    <>
      <FlexCol pt={2} px={2}>
        <FlexRow centered gap={1}>
          <PluginsBreadcrumbs path={path} />

          <FlexRow gap={0.5}>
            <ToolButton
              description={t("actions.openFileLocation.description")}
              icon={FolderIcon}
              onClick={() => openPluginFolder(parentPath)}
            />

            <ToolButton
              description={t("actions.removeFile.description")}
              icon={RemoveIcon}
              onClick={() => {
                removePluginFile(path)
                openPluginsView(parentPath)
              }}
            />
          </FlexRow>
        </FlexRow>

        {banners && <Banners banners={banners} />}
      </FlexCol>

      <Tabs data={fileData} file={file} path={path} tabs={tabs} />
    </>
  )
}
