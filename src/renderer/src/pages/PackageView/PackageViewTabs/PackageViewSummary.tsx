import { Box, Typography } from "@mui/material"
import { useTranslation } from "react-i18next"

import { getCategories, getCategoryLabel } from "@common/categories"
import { getFeatureLabel } from "@common/i18n"
import { getRequirementLabel, getRequirementValueLabel } from "@common/options"
import { PackageID } from "@common/packages"
import { entries } from "@common/utils/objects"
import { MarkdownView } from "@components/MarkdownView"
import { PackageBanners } from "@components/PackageBanners"
import { getAuthorName } from "@components/PackageList/utils"
import { Text } from "@components/Text"
import { useCurrentVariant, usePackageInfo } from "@utils/packages"
import { useAuthors, useGlobalOptions } from "@utils/store"

export function PackageViewSummary({ packageId }: { packageId: PackageID }): JSX.Element {
  const authors = useAuthors()
  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useCurrentVariant(packageId)
  const globalOptions = useGlobalOptions()

  const { t } = useTranslation("PackageViewSummary")

  return (
    <Box>
      {variantInfo.description && <MarkdownView md={variantInfo.description} />}
      {/* TODO: Better formatting (with Simtropolis user links?) */}
      <Typography variant="body2">
        <b>{t("authors")}:</b>{" "}
        {variantInfo.authors.map(authorId => getAuthorName(authorId, authors)).join(", ")}
      </Typography>
      {/* TODO: Better formatting */}
      <Typography variant="body2">
        <b>{t("category")}:</b> {getCategories(variantInfo).map(getCategoryLabel).join(", ")}
      </Typography>
      {/* TODO: Better formatting */}
      {variantInfo.repository && (
        <Text maxLines={1} variant="body2">
          <b>{t("repository")}:</b>{" "}
          <a href={variantInfo.repository} target="_blank" rel="noreferrer">
            {variantInfo.repository}
          </a>
        </Text>
      )}
      {/* TODO: Better formatting */}
      {packageInfo.features && (
        <Typography variant="body2">
          <b>{t("features")}:</b>{" "}
          {packageInfo.features.map(feature => getFeatureLabel(t, feature)).join(", ")}
        </Typography>
      )}
      {/* TODO: Better formatting */}
      {variantInfo.requirements && (
        <Typography variant="body2">
          <b>{t("requirements")}:</b>
          <ul>
            {entries(variantInfo.requirements).map(([requirement, value]) => (
              <li key={requirement}>
                {getRequirementLabel(t, requirement, variantInfo.options, globalOptions)}
                {": "}
                {getRequirementValueLabel(
                  t,
                  requirement,
                  value,
                  variantInfo.options,
                  globalOptions,
                )}
              </li>
            ))}
          </ul>
        </Typography>
      )}
      <PackageBanners packageId={packageId} />
    </Box>
  )
}
