import { Box, Link, Typography } from "@mui/material"
import { entries, keys } from "@salinco/nice-utils"
import { Fragment, useCallback } from "react"
import { useTranslation } from "react-i18next"

import type { AuthorID } from "@common/authors"
import { getCategories, getCategoryLabel } from "@common/categories"
import { getFeatureLabel } from "@common/i18n"
import { getRequirementLabel, getRequirementValueLabel } from "@common/options"
import { MarkdownView } from "@components/MarkdownView"
import { PackageBanners } from "@components/PackageBanners/PackageBanners"
import { getAuthorName } from "@components/Tags/utils" // TODO: Move
import { Text } from "@components/Text"
import { Page, useHistory } from "@utils/navigation"
import { useCurrentVariant, usePackageInfo } from "@utils/packages"
import { useAuthors, useStore } from "@utils/store"
import type { PackageViewTabInfoProps } from "./tabs"

export function PackageViewSummary({ packageId }: PackageViewTabInfoProps): JSX.Element {
  const authors = useAuthors()
  const categories = useStore(store => store.categories)
  const profileOptions = useStore(store => store.profileOptions)
  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useCurrentVariant(packageId)

  const history = useHistory()

  const { t } = useTranslation("PackageViewSummary")

  const openAuthorView = useCallback(
    (authorId: AuthorID) => {
      history.push({ page: Page.AuthorView, data: { authorId } })
    },
    [history],
  )

  return (
    <Box>
      {variantInfo.summary && (
        <Text sx={{ fontStyle: "italic", marginBottom: 2 }} variant="body2">
          {variantInfo.summary}
        </Text>
      )}
      {variantInfo.description && <MarkdownView md={variantInfo.description} />}
      {/* TODO: Better formatting (with Simtropolis user links?) */}
      <Typography variant="body2">
        <b>{`${t("authors")}: `}</b>
        {variantInfo.authors.map((authorId, index) => {
          const authorName = getAuthorName(authorId, authors)
          return (
            <Fragment key={authorId}>
              {index > 0 && ", "}
              <Link onClick={() => openAuthorView(authorId)} sx={{ cursor: "pointer" }}>
                {authorName}
              </Link>
            </Fragment>
          )
        })}
      </Typography>
      {/* TODO: Better formatting */}
      <Typography variant="body2">
        <b>{`${t("category")}: `}</b>
        {getCategories(variantInfo)
          .map(categoryId => getCategoryLabel(categoryId, categories))
          .join(", ")}
      </Typography>
      {/* TODO: Better formatting */}
      {variantInfo.repository && (
        <Text maxLines={1} variant="body2">
          <b>{`${t("repository")}: `}</b>
          <a href={variantInfo.repository} target="_blank" rel="noreferrer">
            {variantInfo.repository}
          </a>
        </Text>
      )}
      {/* TODO: Better formatting */}
      {variantInfo.support && (
        <Text maxLines={1} variant="body2">
          <b>{`${t("support")}: `}</b>
          <a href={variantInfo.support} target="_blank" rel="noreferrer">
            {variantInfo.support}
          </a>
        </Text>
      )}
      {/* TODO: Better formatting */}
      {packageInfo.features && (
        <Typography variant="body2">
          <b>{`${t("features")}: `}</b>
          {packageInfo.features.map(feature => getFeatureLabel(t, feature)).join(", ")}
        </Typography>
      )}
      {/* TODO: Better formatting */}
      {variantInfo.requirements && !!keys(variantInfo.requirements).length && (
        <Typography variant="body2">
          <b>{`${t("requirements")}: `}</b>
          <ul>
            {entries(variantInfo.requirements).map(([requirement, value]) => (
              <li key={requirement}>
                {`${getRequirementLabel(t, requirement, variantInfo.options, profileOptions)}: ${getRequirementValueLabel(
                  t,
                  requirement,
                  value,
                  variantInfo.options,
                  profileOptions,
                )}`}
              </li>
            ))}
          </ul>
        </Typography>
      )}
      <PackageBanners packageId={packageId} />
    </Box>
  )
}
