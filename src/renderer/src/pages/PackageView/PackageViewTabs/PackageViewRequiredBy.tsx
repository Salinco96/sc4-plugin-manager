import { List } from "@mui/material"

import { PackageListItem } from "@components/PackageList"
import { usePackageStatus } from "@utils/packages"

export function PackageViewRequiredBy({ packageId }: { packageId: string }): JSX.Element {
  const packageStatus = usePackageStatus(packageId)

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {packageStatus?.requiredBy?.map((dependencyId, index) => (
        <PackageListItem key={dependencyId} index={index} item={dependencyId} />
      ))}
    </List>
  )
}
