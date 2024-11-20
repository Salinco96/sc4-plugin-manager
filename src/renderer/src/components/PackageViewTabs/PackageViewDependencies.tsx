import { List } from "@mui/material"

import type { PackageID } from "@common/packages"
import { PackageListItem } from "@components/PackageList/PackageListItem"
import { useCurrentVariant } from "@utils/packages"

export function PackageViewDependencies({ packageId }: { packageId: PackageID }): JSX.Element {
  const variantInfo = useCurrentVariant(packageId)

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo.dependencies?.map(dependency => (
        <PackageListItem key={dependency.id} packageId={dependency.id} />
      ))}
    </List>
  )
}
