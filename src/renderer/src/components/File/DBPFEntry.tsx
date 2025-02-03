import { DesignServices as PatchIcon, Preview as PreviewIcon } from "@mui/icons-material"
import { ListItem, Typography } from "@mui/material"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { DBPFDataType, type DBPFEntryInfo, type TGI } from "@common/dbpf"
import type { ExemplarDataPatch } from "@common/exemplars"
import { VariantState } from "@common/types"
import { Tag } from "@components/Tags/Tag"
import { TagType } from "@components/Tags/utils"
import { ToolButton } from "@components/ToolButton"
import { EntryViewer } from "@components/Viewer/EntryViewer"

import { getDBPFEntryLabel } from "./utils"

const EDITABLE_TYPES = [
  // Exemplars
  DBPFDataType.EXEMPLAR,
]

// TODO: FSH, S3D, audio files...
const VIEWABLE_TYPES = [
  ...EDITABLE_TYPES,
  DBPFDataType.BMP,
  DBPFDataType.JFIF,
  DBPFDataType.LTEXT,
  DBPFDataType.PNG,
  // TODO: XML not viewable atm because it can be confusing if values are not matching exemplar
  // DBPFDataType.XML,
]

export interface DBPFEntryProps {
  entry: DBPFEntryInfo
  isLocal?: boolean
  isOverridden?: boolean
  isPatched?: boolean
  loadEntry: (entryId: TGI) => Promise<void>
  patchFile: (patch: { [entryId in TGI]?: ExemplarDataPatch | null }) => void
}

export function DBPFEntry({
  entry,
  isLocal = false,
  isOverridden = false,
  isPatched = false,
  loadEntry,
  patchFile,
}: DBPFEntryProps): JSX.Element {
  const [isViewing, setViewing] = useState(false)

  const { t } = useTranslation("PackageViewFiles")

  const isEditable = EDITABLE_TYPES.includes(entry.type)
  const isViewable = VIEWABLE_TYPES.includes(entry.type)
  const compression = entry.uncompressed ? 1 - entry.size / entry.uncompressed : 0

  return (
    <ListItem
      disablePadding
      sx={{
        alignItems: "center",
        display: "flex",
        gap: 0.5,
        opacity: isOverridden ? 0.5 : undefined,
      }}
    >
      <Typography
        sx={{ cursor: isOverridden ? "help" : undefined }}
        title={isOverridden ? t("entry.overridden") : undefined}
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
            if (!entry.data || (isPatched && !entry.original)) {
              await loadEntry(entry.id)
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
          onPatch={patch => patchFile({ [entry.id]: patch })}
          open
        />
      )}
    </ListItem>
  )
}
