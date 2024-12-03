import { UnfoldLess as CollapseIcon, UnfoldMore as ExpandIcon } from "@mui/icons-material"
import { List, Typography } from "@mui/material"
import { groupBy, mapDefined, mapValues, size, values } from "@salinco/nice-utils"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import type { DBPFFile, TGI } from "@common/dbpf"
import type { PackageID } from "@common/packages"
import type { FileInfo } from "@common/variants"
import { FlexBox } from "@components/FlexBox"
import { ToolButton } from "@components/ToolButton"

import { PackageEntry } from "./PackageEntry"
import { DBPFEntryCategory, getDBPFEntryCategory, getDBPFEntryCategoryLabel } from "./utils"

export interface PackageEntriesProps {
  file: FileInfo
  fileData: DBPFFile
  overriddenEntries?: TGI[]
  packageId: PackageID
  setFileData: (fileData: DBPFFile) => void
}

export function PackageEntries({
  file,
  fileData,
  overriddenEntries,
  packageId,
  setFileData,
}: PackageEntriesProps): JSX.Element {
  const expandable = size(fileData.entries) > 8

  const categorizedEntries = useMemo(() => {
    return mapValues(groupBy(values(fileData.entries), getDBPFEntryCategory), entries =>
      entries.sort((a, b) => a.id.localeCompare(b.id)),
    )
  }, [fileData])

  const [expandedCategories, setExpandedCategories] = useState(() => {
    return mapValues(categorizedEntries, (entries, category) => {
      return !expandable || category === DBPFEntryCategory.EXEMPLARS
    })
  })

  const { t } = useTranslation("PackageViewFiles")

  return (
    <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 1 }}>
      {mapDefined(values(DBPFEntryCategory), category => {
        const entries = categorizedEntries[category]
        if (!entries?.length) {
          return
        }

        const expanded = !!expandedCategories[category]

        return (
          <FlexBox direction="column" key={category}>
            <FlexBox sx={{ alignItems: "center", gap: 0.5 }}>
              {expandable && (
                <ToolButton
                  description={t(expanded ? "hideContents" : "showContents")}
                  icon={expanded ? CollapseIcon : ExpandIcon}
                  onClick={() => {
                    setExpandedCategories({
                      ...expandedCategories,
                      [category]: !expanded,
                    })
                  }}
                  size={12}
                />
              )}
              <Typography variant="caption">
                {getDBPFEntryCategoryLabel(t, category, entries.length)}
              </Typography>
              <FlexBox sx={{ borderTop: "1px dotted currentColor", flex: 1, marginLeft: 0.5 }} />
            </FlexBox>
            {expanded && (
              <List disablePadding>
                {entries.map(entry => (
                  <PackageEntry
                    entry={entry}
                    file={file}
                    fileData={fileData}
                    key={entry.id}
                    overridden={overriddenEntries?.includes(entry.id)}
                    packageId={packageId}
                    setFileData={setFileData}
                  />
                ))}
              </List>
            )}
          </FlexBox>
        )
      })}
    </List>
  )
}
