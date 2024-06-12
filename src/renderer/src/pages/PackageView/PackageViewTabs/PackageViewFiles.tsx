import { List, ListItem } from "@mui/material"

import { useCurrentVariant } from "@utils/packages"
import { useStoreActions } from "@utils/store"

export function PackageViewFiles({ packageId }: { packageId: string }): JSX.Element {
  const actions = useStoreActions()
  const variantInfo = useCurrentVariant(packageId)

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo?.files?.map(file => (
        <ListItem
          key={file.path}
          onClick={() => actions.openPackageFile(packageId, variantInfo.id, file.path)}
        >
          {file.path}
        </ListItem>
      ))}
    </List>
  )
}
