import {
  Settings as ConfigIcon,
  Topic as DocsIcon,
  Folder as FilesIcon,
  GitHub as GitHubIcon,
  Notes as ReadmeIcon,
  Language as WebIcon,
} from "@mui/icons-material"
import { useTranslation } from "react-i18next"

import { FlexBox } from "@components/FlexBox"
import { useCurrentVariant } from "@utils/packages"
import { useStoreActions } from "@utils/store"

import { PackageToolButton } from "./PackageToolButton"

export function PackageTools({ packageId }: { packageId: string }): JSX.Element {
  const actions = useStoreActions()
  const variantInfo = useCurrentVariant(packageId)
  const variantId = variantInfo.id

  const docsPath = variantInfo.docs
  const readmePath = variantInfo.readme

  const { t } = useTranslation("PackageTools")

  return (
    <FlexBox alignItems="center" gap={0.5} mx={0.5}>
      {variantInfo.url && (
        <PackageToolButton
          description={t("openUrl")}
          icon={WebIcon}
          onClick={() => actions.openVariantURL(packageId, variantId)}
        />
      )}
      {variantInfo.repository && (
        <PackageToolButton
          description={t("openRepository")}
          icon={GitHubIcon}
          onClick={() => actions.openVariantRepository(packageId, variantId)}
        />
      )}
      {variantInfo.installed && (
        <PackageToolButton
          description={t("openConfig")}
          icon={ConfigIcon}
          onClick={() => actions.openPackageConfig(packageId)}
        />
      )}
      {variantInfo.installed && (
        <PackageToolButton
          description={t("openFiles")}
          icon={FilesIcon}
          onClick={() => actions.openPackageFile(packageId, variantId, "")}
        />
      )}
      {variantInfo.installed && docsPath && (
        <PackageToolButton
          description={t("openDocs")}
          icon={DocsIcon}
          onClick={() => actions.openPackageFile(packageId, variantId, docsPath)}
        />
      )}
      {variantInfo.installed && readmePath && (
        <PackageToolButton
          description={t("openReadme")}
          icon={ReadmeIcon}
          onClick={() => actions.openPackageFile(packageId, variantId, readmePath)}
        />
      )}
    </FlexBox>
  )
}
