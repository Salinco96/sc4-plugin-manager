import {
  JoinInner as CombineAndIcon,
  JoinFull as CombineOrIcon,
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
import { difference, keys, values } from "@salinco/nice-utils"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { getCategoryLabel } from "@common/categories"
import { VariantState } from "@common/types"
import { getLastWord, getStartOfWordSearchRegex, removeLastWord } from "@common/utils/regex"
import { getStateLabel } from "@common/variants"
import {
  type SerializedTag,
  TagType,
  deserializeTag,
  getTagLabel,
  getTagLongLabel,
  isValidTag,
  serializeTag,
} from "@components/Tags/utils"
import { setPackageFilters } from "@stores/actions"
import { store } from "@stores/main"

export function PackageListFilters(): JSX.Element {
  const authors = store.useAuthors()
  const categories = store.useCategories()
  const packageFilters = store.usePackageFilters()

  const { t } = useTranslation("PackageListFilters")

  const categoryIds = keys(categories)
  const states = useMemo(() => Object.values(VariantState).sort(), [])

  const options: SerializedTag[] = useMemo(() => {
    const lastWord = getLastWord(packageFilters.search)
    if (!lastWord) {
      return []
    }

    const pattern = getStartOfWordSearchRegex(lastWord)

    return [
      ...difference(
        values(authors)
          .filter(author => pattern.test(author.search ?? author.name))
          .map(author => author.id),
        packageFilters.authors,
      ).map(authorId => serializeTag(TagType.AUTHOR, authorId)),
      ...difference(
        categoryIds.filter(categoryId => pattern.test(getCategoryLabel(categoryId, categories))),
        packageFilters.categories,
      ).map(category => serializeTag(TagType.CATEGORY, category)),
      ...difference(
        states.filter(state => pattern.test(getStateLabel(t, state))),
        packageFilters.states,
      ).map(state => serializeTag(TagType.STATE, state)),
    ]
  }, [authors, categories, categoryIds, packageFilters, states, t])

  const tags: SerializedTag[] = useMemo(() => {
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
        onChange={(_e, value) => setPackageFilters({ state: value ?? null })}
        size="small"
      >
        <Tooltip placement="bottom" title={t("actions.showOnlyEnabled")}>
          <ToggleButton value={VariantState.ENABLED}>
            <EnabledIcon />
          </ToggleButton>
        </Tooltip>
        <Tooltip placement="bottom" title={t("actions.showOnlyInstalled")}>
          <ToggleButton value={VariantState.INSTALLED}>
            <DownloadedIcon />
          </ToggleButton>
        </Tooltip>
        <Tooltip placement="bottom" title={t("actions.showOnlyLocal")}>
          <ToggleButton value={VariantState.LOCAL}>
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
        onChange={(_e, values) => {
          setPackageFilters({
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
      <ToggleButtonGroup
        value={packageFilters.combine === "and" ? [] : ["combine"]}
        onChange={(_e, values) => {
          setPackageFilters({
            combine: values.includes("combine") ? "or" : "and",
          })
        }}
        size="small"
      >
        <Tooltip
          placement="bottom"
          title={t(`actions.combine${packageFilters.combine === "and" ? "Or" : "And"}`)}
        >
          <ToggleButton value="combine">
            {packageFilters.combine === "and" ? <CombineAndIcon /> : <CombineOrIcon />}
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
      <Autocomplete<SerializedTag, true, false, true>
        disableCloseOnSelect
        disablePortal
        // We do our own filtering
        filterOptions={options => options}
        freeSolo
        getOptionLabel={option => {
          if (isValidTag(option)) {
            return getTagLabel(t, deserializeTag(option), authors, categories)
          }

          return option
        }}
        inputValue={packageFilters.search}
        limitTags={4}
        multiple
        onChange={(_e, values, reason) => {
          const filters = { ...packageFilters }

          filters.authors = []
          filters.categories = []
          filters.states = []

          for (const value of values) {
            if (isValidTag(value)) {
              const tag = deserializeTag(value)
              if (tag.type === TagType.AUTHOR) {
                filters.authors.push(tag.value)
              } else if (tag.type === TagType.CATEGORY) {
                filters.categories.push(tag.value)
              } else if (tag.type === TagType.STATE) {
                filters.states.push(tag.value)
              }
            }
          }

          if (!filters.states.includes(VariantState.ERROR)) {
            filters.onlyErrors = false
          }

          if (!filters.states.includes(VariantState.NEW)) {
            filters.onlyNew = false
          }

          if (!filters.states.includes(VariantState.OUTDATED)) {
            filters.onlyUpdates = false
          }

          if (reason === "selectOption") {
            filters.search = removeLastWord(filters.search)
          }

          setPackageFilters(filters)
        }}
        onInputChange={(_e, search, reason) => {
          if (reason !== "reset") {
            setPackageFilters({ search })
          }
        }}
        options={options}
        size="small"
        sx={{ flex: 1 }}
        renderInput={props => <TextField {...props} autoFocus label={t("search.label")} />}
        renderOption={(props, option) => (
          <li {...props} key={option}>
            {getTagLongLabel(t, deserializeTag(option), authors, categories)}
          </li>
        )}
        value={tags}
      />
    </Box>
  )
}
