import { Box, Link, Typography } from "@mui/material"
import { collect, isEmpty, values } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import { getAuthorName } from "@common/authors"
import { getFeatureLabel } from "@common/i18n"
import { getRequirementText } from "@common/options"
import type { PackageID } from "@common/packages"
import { MarkdownView } from "@components/MarkdownView"
import { PackageBanners } from "@components/PackageBanners/PackageBanners"
import { Text } from "@components/Text"
import { store } from "@stores/main"
import { useNavigation } from "@utils/navigation"

export function PackageViewSummary({ packageId }: { packageId: PackageID }): JSX.Element {
  const authors = store.useAuthors()
  const profileOptions = store.useProfileOptions()
  const packageInfo = store.usePackageInfo(packageId)
  const variantInfo = store.useCurrentVariant(packageId)

  const { openAuthorView } = useNavigation()

  const { t } = useTranslation("PackageViewSummary")

  return (
    <Box>
      {variantInfo.summary && (
        <Text fontStyle="italic" mb={2} variant="body2">
          {variantInfo.summary}
        </Text>
      )}

      {variantInfo.description && (
        <MarkdownView
          md={variantInfo.description.replace(
            /\[.+\][(](https:[/][/]community[.]simtropolis[.]com[/]profile[/][^)/]+[/])[)]/g,
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

      {!!packageInfo.features?.length && (
        <Typography variant="body2">
          <b>{`${t("features")}: `}</b>
          {packageInfo.features.map(feature => getFeatureLabel(t, feature)).join(", ")}
        </Typography>
      )}

      {!!variantInfo.credits?.length && (
        <>
          <Typography variant="body2">
            <b>{`${t("credits")}: `}</b>
          </Typography>
          <ul style={{ marginBlockStart: 0, marginBlockEnd: 0 }}>
            {variantInfo.credits.map(({ id, text }) => (
              <Typography component="li" key={id ?? text} variant="body2">
                {id && (
                  <Link onClick={() => openAuthorView(id)} sx={{ cursor: "pointer" }}>
                    {getAuthorName(id, authors)}
                  </Link>
                )}
                {id && text && " - "}
                {text}
              </Typography>
            ))}
          </ul>
        </>
      )}

      {!!variantInfo.thanks?.length && (
        <>
          <Typography variant="body2">
            <b>{`${t("thanks")}: `}</b>
          </Typography>
          <ul style={{ marginBlockStart: 0, marginBlockEnd: 0 }}>
            {variantInfo.thanks.map(({ id, text }) => (
              <Typography component="li" key={id ?? text} variant="body2">
                {id && (
                  <Link onClick={() => openAuthorView(id)} sx={{ cursor: "pointer" }}>
                    {getAuthorName(id, authors)}
                  </Link>
                )}
                {id && text && " - "}
                {text}
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
