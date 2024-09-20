import { List } from "@mui/material"

import { PackageID } from "@common/packages"
import { PackageListItem } from "@components/PackageList"
import { useCurrentVariant } from "@utils/packages"

export function PackageViewOptionalDependencies({
  packageId,
}: {
  packageId: PackageID
}): JSX.Element {
  const variantInfo = useCurrentVariant(packageId)

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo.optional?.map((dependencyId, index) => (
        <PackageListItem key={dependencyId} index={index} item={dependencyId} />
      ))}
    </List>
  )
}
