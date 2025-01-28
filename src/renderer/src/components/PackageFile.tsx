import type { DBPFFile as DBPFFileType, TGI } from "@common/dbpf"
import type { PackageID } from "@common/packages"
import { isOverride } from "@common/types"
import type { FileInfo } from "@common/variants"
import {
  loadVariantFileEntries,
  loadVariantFileEntry,
  openPackageFile,
  patchVariantFileEntries,
} from "@stores/actions"
import { store } from "@stores/main"

import { DBPFFile } from "./DBPF/DBPFFile"

export interface PackageFileProps {
  file: FileInfo
  fileData?: DBPFFileType
  isDisabled?: boolean
  overriddenEntries?: TGI[]
  packageId: PackageID
  setFileData: (data: DBPFFileType) => void
}

export function PackageFile({
  file,
  fileData,
  isDisabled,
  overriddenEntries,
  packageId,
  setFileData,
}: PackageFileProps): JSX.Element {
  const variantInfo = store.useCurrentVariant(packageId)

  const parentPath = file.path.replace(/[\\/]?[^\\/]+$/, "")

  return (
    <DBPFFile
      fileData={fileData}
      filePath={file.path}
      isDisabled={isDisabled}
      isLocal={variantInfo.local}
      isOverride={isOverride(file)}
      loadEntries={async () => {
        setFileData(await loadVariantFileEntries(packageId, variantInfo.id, file.path))
      }}
      loadEntry={async entryId => {
        if (fileData) {
          const entry = await loadVariantFileEntry(packageId, variantInfo.id, file.path, entryId)
          setFileData({
            ...fileData,
            entries: {
              ...fileData.entries,
              [entryId]: entry,
            },
          })
        }
      }}
      onPatch={async patch => {
        setFileData(await patchVariantFileEntries(packageId, variantInfo.id, file.path, patch))
      }}
      openFileLocation={() => openPackageFile(packageId, variantInfo.id, parentPath)}
      overriddenEntries={overriddenEntries}
      patches={file.patches}
    />
  )
}
