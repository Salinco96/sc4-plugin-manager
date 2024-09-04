import { Box, Typography } from "@mui/material"
import { useTranslation } from "react-i18next"

import { getCategories, getCategoryLabel } from "@common/categories"
import { getFeatureLabel } from "@common/i18n"
import { getRequirementLabel, getRequirementValueLabel } from "@common/options"
import { entries } from "@common/utils/objects"
import { MarkdownView } from "@components/MarkdownView"
import { PackageBanners } from "@components/PackageBanners"
import { Text } from "@components/Text"
import { useCurrentVariant } from "@utils/packages"
import { useStore } from "@utils/store"

export function PackageViewSummary({ packageId }: { packageId: string }): JSX.Element {
  const variantInfo = useCurrentVariant(packageId)
  const globalOptions = useStore(store => store.globalOptions)

  const { t } = useTranslation("PackageViewSummary")

  return (
    <Box>
      {variantInfo.description && <MarkdownView md={variantInfo.description} />}
      {/* TODO: Better formatting (with Simtropolis user links?) */}
      <Typography variant="body2">
        <b>{t("authors")}:</b> {variantInfo.authors.join(", ")}
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
      {variantInfo.url && (
        <Text maxLines={1} variant="body2">
          <b>{t("url")}:</b>{" "}
          <a href={variantInfo.url} target="_blank" rel="noreferrer">
            {variantInfo.url}
          </a>
        </Text>
      )}
      {/* TODO: Better formatting */}
      {variantInfo.features && (
        <Typography variant="body2">
          <b>{t("features")}:</b>{" "}
          {variantInfo.features.map(feature => getFeatureLabel(t, feature)).join(", ")}
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
