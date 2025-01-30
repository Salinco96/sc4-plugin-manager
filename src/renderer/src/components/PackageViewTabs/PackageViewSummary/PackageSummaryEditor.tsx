import { useTranslation } from "react-i18next"

import type { AuthorID } from "@common/authors"
import type { CategoryID } from "@common/categories"
import { type PackageID, getOwnerId } from "@common/packages"
import type { EditableVariantInfo, VariantInfo } from "@common/variants"
import { FlexCol, FlexRow } from "@components/FlexBox"
import { ArraySelectInput } from "@components/Input/ArraySelectInput"
import { MarkdownInput } from "@components/Input/MarkdownInput"
import { MultiSelectInput } from "@components/Input/MultiSelectInput"
import type { SelectOption } from "@components/Input/SelectInput"
import { collect } from "@salinco/nice-utils"
import { store } from "@stores/main"
import { useMemo } from "react"
import { BooleanInput } from "../../Input/BooleanInput"
import { TextInput } from "../../Input/TextInput"

function PackageSummaryEditor({
  data,
  errors,
  packageId,
  setData,
  variantInfo,
}: {
  data: EditableVariantInfo
  errors: Partial<Record<keyof EditableVariantInfo, string>> | undefined
  packageId: PackageID
  setData: (variantInfo: EditableVariantInfo) => void
  variantInfo: VariantInfo
}): JSX.Element {
  const authors = store.useAuthors()
  const categories = store.useCategories()

  const authorOptions: SelectOption<AuthorID>[] = useMemo(() => {
    const ownerId = getOwnerId(packageId)
    return collect(authors, (author, authorId) => ({
      fixed: authorId === ownerId,
      label: author.name,
      value: authorId,
    }))
  }, [authors, packageId])

  const categoryOptions: SelectOption<CategoryID>[] = useMemo(() => {
    return collect(categories, (category, categoryId) => ({
      label: category.label,
      value: categoryId,
    }))
  }, [categories])

  const { t } = useTranslation("PackageSummaryEditor")

  return (
    <FlexCol fullWidth gap={2}>
      <TextInput
        error={errors?.name}
        label={t("name.label")}
        name="name"
        onChange={name => setData({ ...data, name })}
        placeholder={variantInfo.id}
        value={data.name}
      />

      <TextInput
        error={errors?.version}
        label={t("version.label")}
        name="version"
        onChange={version => setData({ ...data, version: version || "" })}
        placeholder={variantInfo.version}
        required
        type="version"
        value={data.version}
      />

      <MultiSelectInput
        enableSearch
        label={t("authors.label")}
        name="authors"
        onChange={authors => setData({ ...data, authors })}
        options={authorOptions}
        required
        value={data.authors}
      />

      <MultiSelectInput
        enableSearch
        label={t("categories.label")}
        name="categories"
        onChange={categories => setData({ ...data, categories })}
        options={categoryOptions}
        required
        value={data.categories}
      />

      <TextInput
        error={errors?.summary}
        label={t("summary.label")}
        name="summary"
        onChange={summary => setData({ ...data, summary })}
        placeholder={t("summary.placeholder")}
        value={data.summary}
      />

      <MarkdownInput
        label={t("description.label")}
        name="description"
        onChange={description => setData({ ...data, description })}
        placeholder={t("description.placeholder")}
        value={data.description}
      />

      <TextInput
        error={errors?.url}
        label={t("url.label")}
        name="url"
        onChange={url => setData({ ...data, url })}
        placeholder={t("summary.placeholder")}
        type="url"
        value={data.url}
      />

      <TextInput
        error={errors?.repository}
        label={t("repository.label")}
        name="repository"
        onChange={repository => setData({ ...data, repository })}
        placeholder={t("repository.placeholder")}
        type="url"
        value={data.repository}
      />

      <TextInput
        error={errors?.support}
        label={t("support.label")}
        name="support"
        onChange={support => setData({ ...data, support })}
        placeholder={t("support.placeholder")}
        type="url"
        value={data.support}
      />

      <ArraySelectInput<AuthorID>
        label={t("credits.label")}
        name="credits"
        onChange={credits => setData({ ...data, credits })}
        options={authorOptions}
        placeholders={{ id: t("credits.id"), text: t("credits.text") }}
        value={data.credits}
      />

      <ArraySelectInput<AuthorID>
        label={t("thanks.label")}
        name="thanks"
        onChange={thanks => setData({ ...data, thanks })}
        options={authorOptions}
        placeholders={{ id: t("thanks.id"), text: t("thanks.text") }}
        value={data.thanks}
      />

      <FlexRow>
        <BooleanInput
          label="This variant is experimental"
          name="experimental"
          onChange={experimental => setData({ ...data, experimental })}
          position="start"
          style="checkbox"
          value={!!data.experimental}
        />

        <BooleanInput
          label="This variant is deprecated"
          name="deprecated"
          onChange={deprecated => setData({ ...data, deprecated })}
          position="start"
          style="checkbox"
          value={!!data.deprecated} // TODO: Package/variant redirection
        />
      </FlexRow>
    </FlexCol>
  )
}

export default PackageSummaryEditor
