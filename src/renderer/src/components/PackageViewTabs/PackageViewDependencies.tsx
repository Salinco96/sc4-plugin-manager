import { checkCondition } from "@common/packages"
import { PackageListItem } from "@components/PackageList/PackageListItem"
import { List } from "@mui/material"
import { useCurrentVariant } from "@utils/packages"
import { useCurrentProfile, useFeatures, useSettings, useStore } from "@utils/store"
import type { PackageViewTabInfoProps } from "./tabs"

export default function PackageViewDependencies({
  packageId,
}: PackageViewTabInfoProps): JSX.Element {
  const features = useFeatures()
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.profileOptions)
  const settings = useSettings()
  const variantInfo = useCurrentVariant(packageId)

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
