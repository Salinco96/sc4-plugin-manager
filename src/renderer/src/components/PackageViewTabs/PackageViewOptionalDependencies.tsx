import { PackageListItem } from "@components/PackageList/PackageListItem"
import { List } from "@mui/material"
import { useCurrentVariant } from "@utils/packages"
import type { PackageViewTabInfoProps } from "./tabs"

export default function PackageViewOptionalDependencies({
  packageId,
}: PackageViewTabInfoProps): JSX.Element {
  const variantInfo = useCurrentVariant(packageId)

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo.optional?.map(dependencyId => (
        <PackageListItem key={dependencyId} packageId={dependencyId} />
      ))}
    </List>
  )
}
