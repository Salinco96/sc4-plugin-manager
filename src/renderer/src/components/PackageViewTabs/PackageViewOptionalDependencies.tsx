import { List } from "@mui/material"

import type { PackageID } from "@common/packages"
import { PackageListItem } from "@components/PackageList/PackageListItem"
import { store } from "@stores/main"

export default function PackageViewOptionalDependencies({
  packageId,
}: { packageId: PackageID }): JSX.Element {
  const variantInfo = store.useCurrentVariant(packageId)

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo.optional?.map(dependencyId => (
        <PackageListItem key={dependencyId} packageId={dependencyId} />
      ))}
    </List>
  )
}
