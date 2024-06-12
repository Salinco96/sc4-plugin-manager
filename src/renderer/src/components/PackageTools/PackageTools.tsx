import {
  Notes as ReadmeIcon,
  Folder as FilesIcon,
  Settings as ConfigIcon,
  Topic as DocsIcon,
  Language as WebIcon,
} from "@mui/icons-material"

import { FlexBox } from "@components/FlexBox"
import { useCurrentVariant } from "@utils/packages"
import { useStoreActions } from "@utils/store"

import { PackageToolButton } from "./PackageToolButton"

export function PackageTools({ packageId }: { packageId: string }): JSX.Element {
  const actions = useStoreActions()
  const variantInfo = useCurrentVariant(packageId)
  const variantId = variantInfo.id

  const readmePath = variantInfo.readme

  return (
    <FlexBox alignItems="center" gap={0.5} mx={0.5}>
      {variantInfo.url && (
        <PackageToolButton
          description="Open URL"
          icon={WebIcon}
          onClick={() => actions.openVariantURL(packageId, variantId)}
        />
      )}
      {variantInfo.installed && (
        <PackageToolButton
          description="Open configuration file"
          icon={ConfigIcon}
          onClick={() => actions.openPackageConfig(packageId)}
        />
      )}
      {variantInfo.installed && (
        <PackageToolButton
          description="Open installed files"
          icon={FilesIcon}
          onClick={() => actions.openPackageFile(packageId, variantId, "")}
        />
      )}
      {readmePath?.startsWith("~docs") && (
        <PackageToolButton
          description="Open installed documentation"
          icon={DocsIcon}
          onClick={() => actions.openPackageFile(packageId, variantId, "~docs")}
        />
      )}
      {readmePath && (
        <PackageToolButton
          description="Open README"
          icon={ReadmeIcon}
          onClick={() => actions.openPackageFile(packageId, variantId, readmePath)}
        />
      )}
    </FlexBox>
  )
}
