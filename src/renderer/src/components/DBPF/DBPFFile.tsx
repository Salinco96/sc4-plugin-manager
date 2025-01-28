import {
  ExpandLess as CollapseIcon,
  ExpandMore as ExpandIcon,
  InsertDriveFile as FileIcon,
  Folder as OpenLocationIcon,
} from "@mui/icons-material"
import { isEmpty } from "@salinco/nice-utils"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { CategoryID } from "@common/categories"
import { type DBPFFile as DBPFFileType, type TGI, isDBPF } from "@common/dbpf"
import type { ExemplarDataPatch } from "@common/exemplars"
import { VariantState } from "@common/types"
import { FlexRow } from "@components/FlexBox"
import { Header } from "@components/Header"
import { ListItem } from "@components/ListItem"
import { Tag } from "@components/Tags/Tag"
import { TagType } from "@components/Tags/utils"
import { ToolButton } from "@components/ToolButton"

import type { Location } from "@utils/navigation"
import { DBPFEntries } from "./DBPFEntries"
import { DBPFEntry } from "./DBPFEntry"

export interface DBPFFileProps {
  fileData: DBPFFileType | undefined
  filePath: string
  isDisabled?: boolean
  isLocal?: boolean
  isOverride?: boolean
  loadEntries: () => Promise<void>
  loadEntry: (entryId: TGI) => Promise<void>
  location?: Location
  onPatch: (patch: { [entryId in TGI]?: ExemplarDataPatch | null }) => void
  openFileLocation: () => void
  overriddenEntries?: TGI[]
  patches?: { [entryId in TGI]?: ExemplarDataPatch }
}

export function DBPFFile({
  fileData,
  filePath,
  isDisabled,
  isLocal,
  isOverride,
  loadEntries,
  location,
  openFileLocation,
  overriddenEntries,
  patches = {},
  ...props
}: DBPFFileProps): JSX.Element {
  const isPatched = !isEmpty(patches)

  const [expanded, setExpanded] = useState(false)

  const { t } = useTranslation("PackageViewFiles")

  return (
    <ListItem
      actions={
        <FlexRow centered gap={0.5}>
          {isDBPF(filePath) && (
            <ToolButton
              description={t(expanded ? "hideContents" : "showContents")}
              icon={expanded ? CollapseIcon : ExpandIcon}
              onClick={async () => {
                if (!fileData) {
                  await loadEntries()
                }

                setExpanded(!expanded)
              }}
            />
          )}
          <ToolButton
            description={t("openFileLocation")}
            icon={OpenLocationIcon}
            onClick={openFileLocation}
          />
        </FlexRow>
      }
      compact
      header={Header}
      icon={FileIcon}
      location={location}
      tags={
        <>
          {isPatched && <Tag dense tag={{ type: TagType.STATE, value: VariantState.PATCHED }} />}
          {isOverride && (
            <Tag color="info" dense tag={{ type: TagType.CATEGORY, value: CategoryID.OVERRIDES }} />
          )}
        </>
      }
      title={filePath}
    >
      {fileData && expanded && (
        <DBPFEntries
          entries={fileData.entries}
          renderEntry={entry => (
            <DBPFEntry
              {...props}
              entry={entry}
              key={entry.id}
              isLocal={isLocal}
              isOverridden={overriddenEntries?.includes(entry.id)}
              isPatched={!!patches[entry.id]}
            />
          )}
        />
      )}
    </ListItem>
  )
}
