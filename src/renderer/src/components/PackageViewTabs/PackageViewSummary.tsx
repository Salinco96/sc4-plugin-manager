import { Box, Link, Typography } from "@mui/material"
import { collect, isEmpty } from "@salinco/nice-utils"
import { useCallback } from "react"
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

      <>
        <Typography variant="body2">
          <b>{`${t("credits")}: `}</b>
        </Typography>
        <ul style={{ marginBlockStart: 0 }}>
          {collect(variantInfo.credits, (reason, authorId) => (
            <li key={authorId}>
              <Link onClick={() => openAuthorView(authorId)} sx={{ cursor: "pointer" }}>
                {getAuthorName(authorId, authors)}
              </Link>
              {reason && ` - ${reason}`}
            </li>
          ))}
        </ul>
      </>

      {variantInfo.thanks && !isEmpty(variantInfo.thanks) && (
        <>
          <Typography variant="body2">
            <b>{`${t("thanks")}: `}</b>
          </Typography>
          <ul style={{ marginBlockStart: 0 }}>
            {collect(variantInfo.thanks, (reason, authorId) => (
              <li key={authorId}>
                <Link onClick={() => openAuthorView(authorId)} sx={{ cursor: "pointer" }}>
                  {getAuthorName(authorId, authors)}
                </Link>
                {reason && ` - ${reason}`}
              </li>
            ))}
          </ul>
        </>
      )}

      <Typography variant="body2">
        <b>{`${t("category")}: `}</b>
        {getCategories(variantInfo)
          .map(categoryId => getCategoryLabel(categoryId, categories))
          .join(", ")}
      </Typography>

      {variantInfo.repository && (
        <Text maxLines={1} variant="body2">
          <b>{`${t("repository")}: `}</b>
          <a href={variantInfo.repository} target="_blank" rel="noreferrer">
            {variantInfo.repository}
          </a>
        </Text>
      )}

      {variantInfo.support && (
        <Text maxLines={1} variant="body2">
          <b>{`${t("support")}: `}</b>
          <a href={variantInfo.support} target="_blank" rel="noreferrer">
            {variantInfo.support}
          </a>
        </Text>
      )}

      {packageInfo.features && (
        <Typography variant="body2">
          <b>{`${t("features")}: `}</b>
          {packageInfo.features.map(feature => getFeatureLabel(t, feature)).join(", ")}
        </Typography>
      )}

      {variantInfo.requirements && !isEmpty(variantInfo.requirements) && (
        <>
          <Typography variant="body2">
            <b>{`${t("requirements")}: `}</b>
          </Typography>
          <ul style={{ marginBlockStart: 0 }}>
            {collect(variantInfo.requirements, (value, requirement) => (
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
        </>
      )}
      <PackageBanners packageId={packageId} />
    </Box>
  )
}
