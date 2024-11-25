import { PackageFile } from "@components/PackageFile/PackageFile"
import { List, ListItem } from "@mui/material"
import { useCurrentVariant } from "@utils/packages"
import type { PackageViewTabInfoProps } from "./tabs"

export default function PackageViewFiles({ packageId }: PackageViewTabInfoProps): JSX.Element {
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
