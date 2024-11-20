import { List, ListItem } from "@mui/material"

import type { PackageID } from "@common/packages"
import { PackageFile } from "@components/PackageFile"
import { useCurrentVariant } from "@utils/packages"

export function PackageViewFiles({ packageId }: { packageId: PackageID }): JSX.Element {
  const variantInfo = useCurrentVariant(packageId)

  return (
    <List sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 0 }}>
      {variantInfo.files
        ?.sort((a, b) => a.path.localeCompare(b.path))
        .map(file => (
          <ListItem key={file.path} sx={{ padding: 0 }}>
            <PackageFile file={file} packageId={packageId} />
          </ListItem>
        ))}
    </List>
  )
}
