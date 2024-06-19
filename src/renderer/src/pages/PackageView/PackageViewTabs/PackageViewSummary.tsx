import { Box, Typography } from "@mui/material"
import { useTranslation } from "react-i18next"

import { getCategories, getCategoryLabel } from "@common/categories"
import { PackageBanners } from "@components/PackageBanners"
import { Text } from "@components/Text"
import { getConflictGroupLabel, useCurrentVariant } from "@utils/packages"

export function PackageViewSummary({ packageId }: { packageId: string }): JSX.Element {
  const variantInfo = useCurrentVariant(packageId)

  const { t } = useTranslation("PackageViewSummary")

  return (
    <Box>
      {variantInfo.description && (
        <Typography sx={{ whiteSpace: "pre-wrap" }} variant="body2">
          {variantInfo.description}
        </Typography>
      )}
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
      {variantInfo.conflictGroups && (
        <Typography variant="body2">
          <b>{t("conflictGroups")}:</b>{" "}
          {variantInfo.conflictGroups.map(groupId => getConflictGroupLabel(t, groupId)).join(", ")}
        </Typography>
      )}
      {/* TODO: Better formatting */}
      {variantInfo.requirements && (
        <Typography variant="body2">
          <b>{t("requirements")}:</b>
          <ul>
            {Object.entries(variantInfo.requirements).map(([requirement, value]) => (
              <li key={requirement}>
                {getConflictGroupLabel(t, requirement)}:{" "}
                {t(value ? "yes" : "no", { ns: "General" })}
              </li>
            ))}
          </ul>
        </Typography>
      )}
      <PackageBanners packageId={packageId} />
    </Box>
  )
}
