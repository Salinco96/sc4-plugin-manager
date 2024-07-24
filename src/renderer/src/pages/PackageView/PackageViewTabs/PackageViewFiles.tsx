import { List, ListItem } from "@mui/material"

import { checkCondition } from "@common/packages"
import { useCurrentVariant } from "@utils/packages"
import { useCurrentProfile, useStore, useStoreActions } from "@utils/store"

export function PackageViewFiles({ packageId }: { packageId: string }): JSX.Element {
  const actions = useStoreActions()
  const features = useStore(store => store.features)
  const profileInfo = useCurrentProfile()
  const profileOptions = useStore(store => store.options)
  const variantInfo = useCurrentVariant(packageId)

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo?.files?.map(file => (
        <ListItem
          key={file.path}
          onClick={() => actions.openPackageFile(packageId, variantInfo.id, file.path)}
          sx={{
            opacity: checkCondition(
              file.condition,
              packageId,
              variantInfo,
              profileInfo,
              profileOptions,
              features,
            )
              ? undefined
              : 0.5,
          }}
        >
          {file.path}
        </ListItem>
      ))}
    </List>
  )
}
