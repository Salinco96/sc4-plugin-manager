import { Box, Typography } from "@mui/material"

import { getCategoryLabel } from "@common/categories"
import { PackageBanners } from "@components/PackageBanners"
import { Text } from "@components/Text"
import { useCurrentVariant } from "@utils/packages"

export function PackageViewInfo({ packageId }: { packageId: string }): JSX.Element {
  const variantInfo = useCurrentVariant(packageId)

  return (
    <Box>
      {variantInfo.description && (
        <Typography variant="body2">{variantInfo.description}</Typography>
      )}
      {/* TODO: Better formatting (with Simtropolis user links?) */}
      <Typography variant="body2">
        <b>Authors:</b> {variantInfo.authors.join(", ")}
      </Typography>
      {/* TODO: Better formatting */}
      <Typography variant="body2">
        <b>Category:</b> {getCategoryLabel(variantInfo.category)}
      </Typography>
      {/* TODO: Better formatting */}
      {variantInfo.url && (
        <Text maxLines={1} variant="body2">
          <b>Website:</b>{" "}
          <a href={variantInfo.url} target="_blank" rel="noreferrer">
            {variantInfo.url}
          </a>
        </Text>
      )}
      {/* TODO: Better formatting */}
      {variantInfo.conflictGroups && (
        <Typography variant="body2">
          <b>Conflict groups:</b> {variantInfo.conflictGroups.join(", ")}
        </Typography>
      )}
      {/* TODO: Better formatting */}
      {variantInfo.requirements && (
        <Typography variant="body2">
          <b>Requirements:</b>
          <ul>
            {Object.entries(variantInfo.requirements).map(([requirement, value]) => (
              <li key={requirement}>
                {requirement}: {String(value)}
              </li>
            ))}
          </ul>
        </Typography>
      )}
      <PackageBanners packageId={packageId} />
    </Box>
  )
}
