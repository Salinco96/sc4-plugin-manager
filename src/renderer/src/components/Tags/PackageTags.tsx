import { useState } from "react"

import { Chip, Tooltip } from "@mui/material"
import { useTranslation } from "react-i18next"

import { PackageID } from "@common/packages"
import { getState } from "@common/types"
import { keys } from "@common/utils/objects"
import { FlexBox } from "@components/FlexBox"
import { useCurrentVariant, usePackageInfo } from "@utils/packages"
import { useAuthors, useCurrentProfile } from "@utils/store"

import { PackageTag } from "./PackageTag"
import { STATE_TAGS, TagType, createTag, getAuthorName, serializeTag } from "./utils"

export function PackageTags({ packageId }: { packageId: PackageID }): JSX.Element | null {
  const authors = useAuthors()
  const currentProfile = useCurrentProfile()
  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useCurrentVariant(packageId)

  const { t } = useTranslation("PackageTag")

  const authorTags = variantInfo.authors.map(authorId => createTag(TagType.AUTHOR, authorId))

  const [authorsExpanded, setAuthorsExpanded] = useState(authorTags.length <= 2)

  const packageTags = [
    ...(authorsExpanded ? authorTags : []),
    ...variantInfo.categories.map(category => createTag(TagType.CATEGORY, category)),
    ...keys(STATE_TAGS)
      .filter(state => STATE_TAGS[state])
      .filter(state => getState(state, packageInfo, variantInfo, currentProfile))
      .map(state => createTag(TagType.STATE, state)),
  ]

  if (packageTags.length === 0) {
    return null
  }

  return (
    <FlexBox direction="row" gap={1} mt={1}>
      {!!authorTags.length && !authorsExpanded && (
        <Tooltip title={t("actions.expandAuthors")}>
          <Chip
            label={t("andOthers", {
              count: authorTags.length - 1,
              label: getAuthorName(authorTags[0].value, authors),
              ns: "General",
            })}
            onClick={() => setAuthorsExpanded(true)}
            size="medium"
            sx={{ borderRadius: 2 }}
            variant="outlined"
          />
        </Tooltip>
      )}
      {packageTags.map(tag => (
        <PackageTag key={serializeTag(tag.type, tag.value)} {...tag} />
      ))}
    </FlexBox>
  )
}
