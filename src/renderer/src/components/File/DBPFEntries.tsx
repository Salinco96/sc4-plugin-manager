import { UnfoldLess as CollapseIcon, UnfoldMore as ExpandIcon } from "@mui/icons-material"
import { List, Typography } from "@mui/material"
import { groupBy, mapDefined, mapValues, size, values } from "@salinco/nice-utils"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import type { DBPFEntry, DBPFFile } from "@common/dbpf"
import { FlexCol, FlexRow } from "@components/FlexBox"

import { DBPFEntryCategory, getDBPFEntryCategory, getDBPFEntryCategoryLabel } from "./utils"

export interface DBPFEntriesProps {
  entries: DBPFFile["entries"]
  renderEntry: (entry: DBPFEntry) => JSX.Element
}

export function DBPFEntries({ entries, renderEntry }: DBPFEntriesProps): JSX.Element {
  const categorizedEntries = useMemo(() => {
    return mapValues(groupBy(values(entries), getDBPFEntryCategory), entries =>
      entries.sort((a, b) => a.id.localeCompare(b.id)),
    )
  }, [entries])

  const expandable = size(entries) > 8 && size(categorizedEntries) > 1

  const [expandedCategories, setExpandedCategories] = useState(() => {
    return mapValues(categorizedEntries, (_, category) => {
      return !expandable || category === DBPFEntryCategory.EXEMPLARS
    })
  })

  const { t } = useTranslation("PackageViewFiles")

  return (
    <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
      {mapDefined(values(DBPFEntryCategory), category => {
        const entries = categorizedEntries[category]
        if (!entries?.length) {
          return
        }

        const expanded = !!expandedCategories[category]

        return (
          <FlexCol key={category}>
            <FlexRow centered gap={0.5}>
              {expandable ? (
                <Typography
                  onClick={() => {
                    setExpandedCategories({
                      ...expandedCategories,
                      [category]: !expanded,
                    })
                  }}
                  sx={{
                    alignItems: "center",
                    cursor: "pointer",
                    display: "flex",
                    gap: 0.5,
                    "&:hover, &:focus-visible": {
                      textDecoration: "underline",
                    },
                  }}
                  tabIndex={0}
                  title={t(expanded ? "hideContents" : "showContents")}
                  variant="caption"
                >
                  {expanded ? (
                    <CollapseIcon fontSize="inherit" />
                  ) : (
                    <ExpandIcon fontSize="inherit" />
                  )}
                  <Typography variant="caption">
                    {getDBPFEntryCategoryLabel(t, category, entries.length)}
                  </Typography>
                </Typography>
              ) : (
                <Typography variant="caption">
                  {getDBPFEntryCategoryLabel(t, category, entries.length)}
                </Typography>
              )}

              <FlexRow borderTop="1px dotted currentColor" flex={1} ml={0.5} />
            </FlexRow>

            {expanded && <List disablePadding>{entries.map(renderEntry)}</List>}
          </FlexCol>
        )
      })}
    </List>
  )
}
