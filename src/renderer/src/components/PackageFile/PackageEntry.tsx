import { DesignServices as PatchIcon, Preview as PreviewIcon } from "@mui/icons-material"
import { ListItem, Typography } from "@mui/material"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { DBPFDataType, type DBPFEntry, type DBPFFile } from "@common/dbpf"
import type { PackageID } from "@common/packages"
import { VariantState } from "@common/types"
import type { FileInfo } from "@common/variants"
import { TagType } from "@components/Tags/utils"
import { ToolButton } from "@components/ToolButton"
import { EntryViewer } from "@components/Viewer/EntryViewer"
import { useCurrentVariant } from "@utils/packages"
import { useStoreActions } from "@utils/store"

import { Tag } from "@components/Tags/Tag"
import { getDBPFEntryLabel } from "./utils"

const EDITABLETYPES = [
  // Exemplars
  DBPFDataType.EXMP,
]

// TODO: FSH, S3D, audio files...
const VIEWABLETYPES = [
  DBPFDataType.BMP,
  DBPFDataType.EXMP,
  DBPFDataType.JFIF,
  DBPFDataType.LTEXT,
  DBPFDataType.PNG,
  // TODO: XML not viewable atm because it can be confusing if values are not matching exemplar
  // DBPFDataType.XML,
]

export interface PackageEntryProps {
  entry: DBPFEntry
  file: FileInfo
  fileData: DBPFFile
  overridden?: boolean
  packageId: PackageID
  setFileData: (fileData: DBPFFile) => void
}

export function PackageEntry({
  entry,
  file,
  fileData,
  overridden,
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
    <ListItem
      disablePadding
      sx={{
        alignItems: "center",
        display: "flex",
        gap: 0.5,
        opacity: overridden ? 0.5 : undefined,
      }}
    >
      <Typography
        sx={{ cursor: overridden ? "help" : undefined }}
        title={overridden ? t("entry.overridden") : undefined}
        variant="body1"
      >
        {t(entry.uncompressed !== undefined ? "entry.labelCompressed" : "entry.label", {
          compression: 100 * compression,
          id: entry.id,
          size: entry.size,
          type: getDBPFEntryLabel(t, entry),
        })}
      </Typography>
      {isViewable && (
        <ToolButton
          description={isEditable ? t("entry.patch") : t("entry.view")}
          icon={isEditable ? PatchIcon : PreviewIcon}
          onClick={async () => {
            if (!entry.data) {
              await loadEntry()
            }

            setViewing(true)
          }}
        />
      )}
      {isPatched && <Tag dense tag={{ type: TagType.STATE, value: VariantState.PATCHED }} />}
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
