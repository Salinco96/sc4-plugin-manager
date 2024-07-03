import { Box, Typography } from "@mui/material"
import { useTranslation } from "react-i18next"
import Markdown, { defaultUrlTransform } from "react-markdown"
import remarkGfm from "remark-gfm"

import { getCategories, getCategoryLabel } from "@common/categories"
import { getFeatureLabel } from "@common/i18n"
import { entries } from "@common/utils/objects"
import { PackageBanners } from "@components/PackageBanners"
import { Text } from "@components/Text"
import { useCurrentVariant } from "@utils/packages"

export function PackageViewSummary({ packageId }: { packageId: string }): JSX.Element {
  const variantInfo = useCurrentVariant(packageId)

  const { t } = useTranslation("PackageViewSummary")

  return (
    <Box>
      {variantInfo.description && (
        <Markdown
          components={{
            p({ ref, ...props }) {
              return <Typography component="p" mb={2} variant="body2" {...props} />
            },
          }}
          remarkPlugins={[remarkGfm]}
          urlTransform={(url, key, node) => {
            if (url.startsWith("/index.php/")) {
              url = "https://www.sc4evermore.com" + url
            }

            if (node.tagName === "a") {
              node.properties.rel = "noreferrer"
              node.properties.target = "_blank"
              node.properties.title = url
            }

            return defaultUrlTransform(url)
          }}
        >
          {variantInfo.description}
        </Markdown>
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
            {entries(variantInfo.requirements).map(([feature, value]) => (
              <li key={feature}>
                {getFeatureLabel(t, feature)}: {t(value ? "yes" : "no", { ns: "General" })}
              </li>
            ))}
          </ul>
        </Typography>
      )}
      <PackageBanners packageId={packageId} />
    </Box>
  )
}
