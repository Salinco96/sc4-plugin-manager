import { DesignServices as PatchIcon, Preview as PreviewIcon } from "@mui/icons-material"
import { ListItem } from "@mui/material"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { DBPFDataType, type DBPFEntry, type DBPFFile } from "@common/dbpf"
import type { PackageID } from "@common/packages"
import { type PackageFile, VariantState } from "@common/types"
import { PackageTag } from "@components/Tags/PackageTag"
import { TagType } from "@components/Tags/utils"
import { ToolButton } from "@components/ToolButton"
import { EntryViewer } from "@components/Viewer/EntryViewer"
import { useCurrentVariant } from "@utils/packages"
import { useStoreActions } from "@utils/store"

import { getDBPFEntryLabel } from "./utils"

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

export interface PackageEntryProps {
  entry: DBPFEntry
  file: PackageFile
  fileData: DBPFFile
  packageId: PackageID
  setFileData: (fileData: DBPFFile) => void
}

export function PackageEntry({
  entry,
  file,
  fileData,
  packageId,
  setFileData,
}: PackageEntryProps): JSX.Element {
  const actions = useStoreActions()
  const variantInfo = useCurrentVariant(packageId)

  const [isViewing, setViewing] = useState(false)

  const { t } = useTranslation("PackageViewFiles")

  const isLocal = !!variantInfo.local
  const isPatched = !!file.patches?.[entry.id]
  const isEditable = EDITABLETYPES.includes(entry.type)
  const isViewable = VIEWABLETYPES.includes(entry.type)
  const compression = entry.uncompressed ? 1 - entry.size / entry.uncompressed : 0

  async function loadEntry() {
    const data = await actions.loadDBPFEntry(packageId, variantInfo.id, file.path, entry.id)

    setFileData({
      ...fileData,
      entries: {
        ...fileData.entries,
        [entry.id]: {
          ...fileData.entries[entry.id],
          ...data,
        },
      },
    })
  }

  return (
    <ListItem disablePadding sx={{ alignItems: "center", display: "flex", gap: 0.5 }}>
      {t(entry.uncompressed !== undefined ? "entry.labelCompressed" : "entry.label", {
        compression: 100 * compression,
        id: entry.id,
        size: entry.size,
        type: getDBPFEntryLabel(t, entry),
      })}
      {isViewable && (
        <ToolButton
          description={isEditable ? t("entry.patch") : t("entry.view")}
          icon={isEditable ? PatchIcon : PreviewIcon}
          onClick={async () => {
            await loadEntry()
            setViewing(true)
          }}
        />
      )}
      {isPatched && <PackageTag dense type={TagType.STATE} value={VariantState.PATCHED} />}
      {isViewing && (
        <EntryViewer
          entry={entry}
          isLocal={isLocal}
          onClose={() => setViewing(false)}
          onPatch={async patch => {
            setFileData(
              await actions.patchDBPFEntries(packageId, variantInfo.id, file.path, {
                [entry.id]: patch,
              }),
            )
          }}
          open
        />
      )}
    </ListItem>
  )
}
