import { Box, Link, Typography } from "@mui/material"
import { collect, isEmpty, values } from "@salinco/nice-utils"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import type { AuthorID } from "@common/authors"
import { getFeatureLabel } from "@common/i18n"
import { getRequirementText } from "@common/options"
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

      {variantInfo.description && (
        <MarkdownView
          md={variantInfo.description.replace(
            /\[.+\]\((https:\/\/community.simtropolis.com\/profile\/[^)]+\/)\)/g,
            (match, url) => {
              const authorInfo = values(authors).find(authorInfo => authorInfo.url === url)
              if (authorInfo) {
                return `[${authorInfo.name}](${url})`
              }

              return match
            },
          )}
        />
      )}

      {variantInfo.url && (
        <Text maxLines={1} variant="body2">
          <b>{`${t("url")}: `}</b>
          <Link href={variantInfo.url} target="_blank" rel="noreferrer">
            {variantInfo.url}
          </Link>
        </Text>
      )}

      {variantInfo.repository && (
        <Text maxLines={1} variant="body2">
          <b>{`${t("repository")}: `}</b>
          <Link href={variantInfo.repository} target="_blank" rel="noreferrer">
            {variantInfo.repository}
          </Link>
        </Text>
      )}

      {variantInfo.support && (
        <Text maxLines={1} variant="body2">
          <b>{`${t("support")}: `}</b>
          <Link href={variantInfo.support} target="_blank" rel="noreferrer">
            {variantInfo.support}
          </Link>
        </Text>
      )}

      {packageInfo.features && (
        <Typography variant="body2">
          <b>{`${t("features")}: `}</b>
          {packageInfo.features.map(feature => getFeatureLabel(t, feature)).join(", ")}
        </Typography>
      )}

      <>
        <Typography variant="body2">
          <b>{`${t("credits")}: `}</b>
        </Typography>
        <ul style={{ marginBlockStart: 0, marginBlockEnd: 0 }}>
          {collect(variantInfo.credits, (reason, authorId) => (
            <Typography component="li" key={authorId} variant="body2">
              <Link
                onClick={() => openAuthorView(authorId)}
                sx={{ cursor: "pointer" }}
                title="View author"
              >
                {getAuthorName(authorId, authors)}
              </Link>
              {reason && ` - ${reason}`}
            </Typography>
          ))}
        </ul>
      </>

      {variantInfo.thanks && !isEmpty(variantInfo.thanks) && (
        <>
          <Typography variant="body2">
            <b>{`${t("thanks")}: `}</b>
          </Typography>
          <ul style={{ marginBlockStart: 0, marginBlockEnd: 0 }}>
            {collect(variantInfo.thanks, (reason, authorId) => (
              <Typography component="li" key={authorId} variant="body2">
                <Link onClick={() => openAuthorView(authorId)} sx={{ cursor: "pointer" }}>
                  {getAuthorName(authorId, authors)}
                </Link>
                {reason && ` - ${reason}`}
              </Typography>
            ))}
          </ul>
        </>
      )}

      {variantInfo.requirements && !isEmpty(variantInfo.requirements) && (
        <>
          <Typography variant="body2">
            <b>{`${t("requirements")}: `}</b>
          </Typography>
          <ul style={{ marginBlockStart: 0, marginBlockEnd: 0 }}>
            {collect(variantInfo.requirements, (value, requirement) => (
              <Typography component="li" key={requirement} variant="body2">
                {getRequirementText(t, requirement, value, variantInfo.options, profileOptions)}
              </Typography>
            ))}
          </ul>
        </>
      )}
      <PackageBanners packageId={packageId} />
    </Box>
  )
}
