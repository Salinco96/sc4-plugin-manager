import { useState } from "react"

import {
  DesignServices as PatchIcon,
  ManageAccountsOutlined as PatchedIcon,
  Preview as PreviewIcon,
} from "@mui/icons-material"
import { ListItem } from "@mui/material"
import { useTranslation } from "react-i18next"

import { DBPFDataType, DBPFEntry, DBPFFile, getFileTypeLabel } from "@common/dbpf"
import { PackageID } from "@common/packages"
import { type PackageFile } from "@common/types"
import { ToolButton } from "@components/ToolButton"
import { DataViewer } from "@components/Viewer/DataViewer"
import { useCurrentVariant } from "@utils/packages"
import { useStoreActions } from "@utils/store"

const EDITABLETYPES = [
  // Exemplars
  DBPFDataType.EXMP,
]

// TODO: FSH, S3D, audio files...
const VIEWABLETYPES = [
  // Images
  DBPFDataType.BMP,
  DBPFDataType.JFIF,
  DBPFDataType.PNG,
  // Text
  DBPFDataType.XML,
  // Others
  DBPFDataType.EXMP,
]

export function PackageEntry({
  entry,
  file,
  fileData,
  packageId,
  setFileData,
}: {
  entry: DBPFEntry
  file: PackageFile
  fileData: DBPFFile
  packageId: PackageID
  setFileData: (fileData: DBPFFile) => void
}): JSX.Element {
  const actions = useStoreActions()
  const variantInfo = useCurrentVariant(packageId)

  const [isEditing, setEditing] = useState(false)
  const [isViewing, setViewing] = useState(false)

  const { t } = useTranslation("PackageViewFiles")

  const tgi = entry.id.split("-")
  const isPatched = !!file.patches?.[entry.id]
  const isEditable = EDITABLETYPES.includes(entry.type)
  const isViewable = VIEWABLETYPES.includes(entry.type)
  const compression = entry.uncompressed ? 1 - entry.size / entry.uncompressed : 0

  async function loadEntry() {
    const { data, original } = await actions.loadDBPFEntry(
      packageId,
      variantInfo.id,
      file.path,
      entry,
    )

    setFileData({
      ...fileData,
      entries: {
        ...fileData.entries,
        [entry.id]: {
          ...fileData.entries[entry.id],
          data,
          original,
        },
      },
    })
  }

  return (
    <ListItem disablePadding sx={{ alignItems: "center", display: "flex", gap: 0.5 }}>
      {t(entry.uncompressed !== undefined ? "entry.labelCompressed" : "entry.label", {
        t: tgi[0],
        g: tgi[1],
        i: tgi[2],
        compression: 100 * compression,
        size: entry.size,
        type: getFileTypeLabel(entry.id),
      })}
      {isViewable && (
        <ToolButton
          description={t("entry.view")}
          icon={PreviewIcon}
          onClick={async () => {
            await loadEntry()
            setEditing(false)
            setViewing(true)
          }}
        />
      )}
      {isEditable && (
        <ToolButton
          description={t("entry.patch")}
          icon={PatchIcon}
          onClick={async () => {
            await loadEntry()
            setEditing(true)
            setViewing(true)
          }}
        />
      )}
      {isPatched && <ToolButton description={t("entry.patched")} icon={PatchedIcon} />}
      {isViewing && (
        <DataViewer
          entry={entry}
          onClose={() => setViewing(false)}
          onPatch={async patch => {
            setFileData(
              await actions.patchDBPFEntries(packageId, variantInfo.id, file.path, {
                [entry.id]: patch,
              }),
            )
          }}
          open
          readonly={!isEditing}
        />
      )}
    </ListItem>
  )
}
