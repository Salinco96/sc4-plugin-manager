import { List } from "@mui/material"

import { PackageListItem } from "@renderer/components/PackageList"
import { useCurrentVariant } from "@renderer/utils/packages"

export function PackageViewDependencies({ packageId }: { packageId: string }): JSX.Element {
  const variantInfo = useCurrentVariant(packageId)

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo?.dependencies?.map((dependencyId, index) => (
        <PackageListItem key={dependencyId} index={index} item={dependencyId} />
      ))}
    </List>
  )
}
