import { useTranslation } from "react-i18next"

import type { DBPFInfo, TGI } from "@common/dbpf"
import type { PackageID } from "@common/packages"
import { isOverride } from "@common/types"
import type { FileInfo } from "@common/variants"
import { FileListItem } from "@components/File/FileListItem"
import { Folder as FolderIcon } from "@mui/icons-material"
import {
  loadPackageFileEntries,
  loadPackageFileEntry,
  openPackageDirectory,
  patchPackageFileEntries,
} from "@stores/actions"
import { store } from "@stores/main"

export interface PackageFileProps {
  file: FileInfo
  fileData?: DBPFInfo
  isDisabled?: boolean
  overriddenEntries?: TGI[]
  packageId: PackageID
  setFileData: (data: DBPFInfo) => void
}

export function PackageFileListItem({
  file,
  fileData,
  isDisabled,
  overriddenEntries,
  packageId,
  setFileData,
}: PackageFileProps): JSX.Element {
  const variantInfo = store.useCurrentVariant(packageId)
  const variantId = variantInfo.id

  const parentPath = file.path.split("/").slice(0, -1).join("/")

  const { t } = useTranslation("PackageViewFiles")

  return (
    <FileListItem
      actions={[
        {
          description: t("openFileLocation"),
          icon: FolderIcon,
          onClick: () => openPackageDirectory(packageId, variantId, parentPath),
        },
      ]}
      dbpf={{
        fileData,
        loadEntries: () => loadPackageFileEntries(packageId, variantId, file.path),
        loadEntry: entryId => loadPackageFileEntry(packageId, variantId, file.path, entryId),
        overriddenEntries,
        patches: file.patches,
        patchFile: patch => patchPackageFileEntries(packageId, variantId, file.path, patch),
        setFileData,
      }}
      path={file.path}
      isDisabled={isDisabled}
      isLocal={variantInfo.local}
      isOverride={isOverride(file)}
    />
  )
}
