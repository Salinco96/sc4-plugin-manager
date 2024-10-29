import { List } from "@mui/material"

import { PackageID } from "@common/packages"
import { PackageListItem } from "@components/PackageList"
import { useCurrentVariant } from "@utils/packages"

export function PackageViewDependencies({ packageId }: { packageId: PackageID }): JSX.Element {
  const variantInfo = useCurrentVariant(packageId)

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo.dependencies?.map((dependency, index) => (
        <PackageListItem key={dependency.id} index={index} item={dependency.id} />
      ))}
    </List>
  )
}
