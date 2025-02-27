import {
  ExpandLess as CollapseIcon,
  ExpandMore as ExpandIcon,
  Extension as ExtensionIcon,
  InsertDriveFile as FileIcon,
  Error as WarningIcon,
} from "@mui/icons-material"
import { isEmpty } from "@salinco/nice-utils"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { CategoryID } from "@common/categories"
import { type DBPFEntryInfo, type DBPFInfo, type TGI, isDBPF } from "@common/dbpf"
import type { ExemplarDataPatch } from "@common/exemplars"
import { VariantState } from "@common/types"
import { FlexRow } from "@components/FlexBox"
import { Header } from "@components/Header"
import { ListItem } from "@components/ListItem"
import { Tag } from "@components/Tags/Tag"
import { TagType } from "@components/Tags/utils"
import { ToolButton, type ToolButtonProps } from "@components/ToolButton"
import type { Location } from "@utils/navigation"

import { Banners, type BannersProps } from "@components/Banners"
import { DBPFEntries } from "./DBPFEntries"
import { DBPFEntry as DBPFEntryComponent } from "./DBPFEntry"

type Action = Pick<ToolButtonProps, "description" | "icon" | "onClick">

export interface FileListItemProps {
  actions?: Action[]
  banners?: BannersProps["banners"]
  dbpf?: {
    error?: string
    fileData: DBPFInfo | undefined
    loadEntries: () => Promise<DBPFInfo>
    loadEntry: (entryId: TGI) => Promise<DBPFEntryInfo>
    overriddenEntries?: TGI[]
    patchFile: (patches: { [entryId in TGI]?: ExemplarDataPatch | null }) => Promise<DBPFInfo>
    patches?: { [entryId in TGI]?: ExemplarDataPatch }
    setFileData: (data: DBPFInfo) => void
  }
  hasIssues?: boolean
  isDisabled?: boolean
  isLocal?: boolean
  isOverride?: boolean
  location?: Location
  path: string
}

export function FileListItem({
  actions,
  banners,
  dbpf,
  hasIssues,
  isDisabled,
  isLocal,
  isOverride,
  location,
  path,
  ...props
}: FileListItemProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const { t } = useTranslation("PackageViewFiles")

  const data = dbpf?.fileData
  const extension = path.split(".").at(-1)?.toLowerCase()
  const isDLL = extension === "dll"
  const isPatched = !!dbpf?.patches && !isEmpty(dbpf.patches)

  return (
    <ListItem
      actions={
        <FlexRow centered gap={0.5}>
          {dbpf && isDBPF(path) && !dbpf.error && (
            <ToolButton
              description={t(expanded ? "hideContents" : "showContents")}
              icon={expanded ? CollapseIcon : ExpandIcon}
              onClick={async () => {
                if (!data) {
                  dbpf.setFileData(await dbpf.loadEntries())
                }

                setExpanded(!expanded)
              }}
            />
          )}

          {actions?.map((action, index) => action && <ToolButton {...action} key={index} />)}
        </FlexRow>
      }
      compact
      header={Header}
      icon={hasIssues ? WarningIcon : isDLL ? ExtensionIcon : FileIcon}
      iconColor={hasIssues ? "warning" : undefined}
      location={location}
      tags={
        <>
          {isPatched && <Tag dense tag={{ type: TagType.STATE, value: VariantState.PATCHED }} />}
          {isOverride && (
            <Tag color="info" dense tag={{ type: TagType.CATEGORY, value: CategoryID.OVERRIDES }} />
          )}
        </>
      }
      title={path.replaceAll("/", " / ")}
    >
      {banners && <Banners banners={banners} compact />}

      {data && expanded && (
        <DBPFEntries
          entries={data.entries}
          renderEntry={entry => (
            <DBPFEntryComponent
              {...props}
              entry={entry}
              key={entry.id}
              isLocal={isLocal}
              isOverridden={!!dbpf.overriddenEntries?.includes(entry.id)}
              isPatched={!!dbpf.patches?.[entry.id]}
              loadEntry={async entryId => {
                const entry = await dbpf.loadEntry(entryId)
                dbpf.setFileData({ ...data, entries: { ...data.entries, [entryId]: entry } })
              }}
              patchFile={async patches => {
                dbpf.setFileData(await dbpf.patchFile(patches))
              }}
            />
          )}
        />
      )}
    </ListItem>
  )
}
