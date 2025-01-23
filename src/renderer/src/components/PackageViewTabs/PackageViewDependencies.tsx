import { List } from "@mui/material"

import { type PackageID, checkCondition } from "@common/packages"
import { PackageListItem } from "@components/PackageList/PackageListItem"
import { store } from "@stores/main"

export default function PackageViewDependencies({
  packageId,
}: { packageId: PackageID }): JSX.Element {
  const features = store.useFeatures()
  const profileInfo = store.useCurrentProfile()
  const profileOptions = store.useProfileOptions()
  const settings = store.useSettings()
  const variantInfo = store.useCurrentVariant(packageId)

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo.dependencies?.map(dependency => (
        <PackageListItem
          key={dependency.id}
          isDisabled={
            !checkCondition(
              dependency.condition,
              packageId,
              variantInfo,
              profileInfo,
              profileOptions,
              features,
              settings,
            )
          }
          packageId={dependency.id}
        />
      ))}
    </List>
  )
}
