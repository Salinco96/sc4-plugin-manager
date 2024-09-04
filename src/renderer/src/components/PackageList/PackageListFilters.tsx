import { useMemo } from "react"

import {
  ViewInAr as DependenciesIcon,
  Download as DownloadedIcon,
  FileDownloadDone as EnabledIcon,
  Science as ExperimentalIcon,
  DoDisturb as IncompatibleIcon,
  FileDownloadOff as LocalIcon,
} from "@mui/icons-material"
import {
  Autocomplete,
  Box,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material"
import { useTranslation } from "react-i18next"

import { getCategoryLabel, getStateLabel } from "@common/categories"
import { PackageState } from "@common/types"
import { difference } from "@common/utils/arrays"
import { keys } from "@common/utils/objects"
import { getLastWord, getStartOfWordSearchRegex, removeLastWord } from "@common/utils/regex"
import { useAuthors, usePackageFilters, useStore, useStoreActions } from "@utils/store"

import {
  TagType,
  deserializeTag,
  getLongTagLabel,
  getTagLabel,
  isValidTag,
  serializeTag,
} from "./utils"

export function PackageListFilters(): JSX.Element {
  const actions = useStoreActions()

  const authors = useAuthors()
  const packageFilters = usePackageFilters()

  const { t } = useTranslation("PackageListFilters")

  const categories = keys(useStore(store => store.categories))
  const states = useMemo(() => Object.values(PackageState).sort(), [])

  const options: string[] = useMemo(() => {
    const lastWord = getLastWord(packageFilters.search)
    if (!lastWord) {
      return []
    }

    const pattern = getStartOfWordSearchRegex(lastWord)

    return [
      ...difference(
        authors.filter(author => pattern.test(author)),
        packageFilters.authors,
      ).map(author => serializeTag(TagType.AUTHOR, author)),
      ...difference(
        categories.filter(category => pattern.test(getCategoryLabel(category))),
        packageFilters.categories,
      ).map(category => serializeTag(TagType.CATEGORY, category)),
      ...difference(
        states.filter(state => pattern.test(getStateLabel(state))),
        packageFilters.states,
      ).map(state => serializeTag(TagType.STATE, state)),
    ]
  }, [authors, categories, packageFilters, states])

  const tags: string[] = useMemo(() => {
    return [
      ...packageFilters.authors.map(author => serializeTag(TagType.AUTHOR, author)),
      ...packageFilters.categories.map(category => serializeTag(TagType.CATEGORY, category)),
      ...packageFilters.states.map(state => serializeTag(TagType.STATE, state)),
    ]
  }, [packageFilters])

  return (
    <Box sx={{ display: "flex", gap: 2, padding: 2, justifyContent: "start" }}>
      <ToggleButtonGroup
        value={packageFilters.state}
        exclusive
        onChange={(_, value) => actions.setPackageFilters({ state: value ?? null })}
        size="small"
      >
        <Tooltip placement="bottom" title={t("actions.showOnlyEnabled")}>
          <ToggleButton value={PackageState.ENABLED}>
            <EnabledIcon />
          </ToggleButton>
        </Tooltip>
        <Tooltip placement="bottom" title={t("actions.showOnlyInstalled")}>
          <ToggleButton value={PackageState.INSTALLED}>
            <DownloadedIcon />
          </ToggleButton>
        </Tooltip>
        <Tooltip placement="bottom" title={t("actions.showOnlyLocal")}>
          <ToggleButton value={PackageState.LOCAL}>
            <LocalIcon />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
      <ToggleButtonGroup
        disabled={packageFilters.onlyErrors || packageFilters.onlyUpdates}
        value={
          packageFilters.onlyErrors || packageFilters.onlyUpdates
            ? []
            : [
                packageFilters.dependencies && "dependencies",
                packageFilters.experimental && "experimental",
                packageFilters.incompatible && "incompatible",
              ].filter(Boolean)
        }
        onChange={(_, values) => {
          actions.setPackageFilters({
            dependencies: values.includes("dependencies"),
            experimental: values.includes("experimental"),
            incompatible: values.includes("incompatible"),
          })
        }}
        size="small"
      >
        <Tooltip
          placement="bottom"
          title={t(`actions.${packageFilters.incompatible ? "hide" : "show"}Incompatible`)}
        >
          <ToggleButton value="incompatible">
            <IncompatibleIcon />
          </ToggleButton>
        </Tooltip>
        <Tooltip
          placement="bottom"
          title={t(`actions.${packageFilters.experimental ? "hide" : "show"}Experimental`)}
        >
          <ToggleButton value="experimental">
            <ExperimentalIcon />
          </ToggleButton>
        </Tooltip>
        <Tooltip
          placement="bottom"
          title={t(`actions.${packageFilters.dependencies ? "hide" : "show"}Dependencies`)}
        >
          <ToggleButton value="dependencies">
            <DependenciesIcon />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
      <Autocomplete<string, true, false, true>
        disableCloseOnSelect
        disablePortal
        // We do our own filtering
        filterOptions={options => options}
        freeSolo
        getOptionLabel={option => getTagLabel(deserializeTag(option))}
        inputValue={packageFilters.search}
        limitTags={4}
        multiple
        onChange={(_, values, reason) => {
          const filters = { ...packageFilters }

          filters.authors = []
          filters.categories = []
          filters.states = []
          for (const value of values) {
            const tag = deserializeTag(value)
            if (tag.type === TagType.AUTHOR) {
              filters.authors.push(tag.value)
            } else if (tag.type === TagType.CATEGORY) {
              filters.categories.push(tag.value)
            } else if (tag.type === TagType.STATE) {
              filters.states.push(tag.value)
            }
          }

          if (!filters.states.includes(PackageState.ERROR)) {
            filters.onlyErrors = false
          }

          if (!filters.states.includes(PackageState.NEW)) {
            filters.onlyNew = false
          }

          if (!filters.states.includes(PackageState.OUTDATED)) {
            filters.onlyUpdates = false
          }

          if (reason === "selectOption" && tags.every(isValidTag)) {
            filters.search = removeLastWord(filters.search)
          }

          actions.setPackageFilters(filters)
        }}
        onInputChange={(_, search, reason) => {
          if (reason !== "reset") {
            actions.setPackageFilters({ search })
          }
        }}
        options={options}
        size="small"
        sx={{ flex: 1 }}
        renderInput={props => <TextField {...props} autoFocus label={t("search.label")} />}
        renderOption={(props, option) => (
          <li key={option} {...props}>
            {getLongTagLabel(deserializeTag(option))}
          </li>
        )}
        value={tags}
      />
    </Box>
  )
}
