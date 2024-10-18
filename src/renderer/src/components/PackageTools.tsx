import { useState } from "react"

import {
  Settings as ConfigIcon,
  Topic as DocsIcon,
  Folder as FilesIcon,
  GitHub as GitHubIcon,
  Tune as OptionsIcon,
  Notes as ReadmeIcon,
  Language as WebIcon,
} from "@mui/icons-material"
import { useTranslation } from "react-i18next"

import { PackageID } from "@common/packages"
import { FlexBox } from "@components/FlexBox"
import { PackageOptionsDialog } from "@components/Options"
import { useCurrentVariant } from "@utils/packages"
import { useStoreActions } from "@utils/store"

import { ToolButton } from "./ToolButton"

export function PackageTools({ packageId }: { packageId: PackageID }): JSX.Element {
  const actions = useStoreActions()
  const variantInfo = useCurrentVariant(packageId)
  const variantId = variantInfo.id

  const docsPath = variantInfo.docs
  const readmePath = variantInfo.readme

  const [openOptions, setOpenOptions] = useState(false)

  const { t } = useTranslation("PackageTools")

  return (
    <FlexBox alignItems="center" gap={0.5} mx={0.5}>
      <PackageOptionsDialog
        onClose={() => setOpenOptions(false)}
        open={openOptions}
        packageId={packageId}
      />
      {!!variantInfo.options?.length && (
        <ToolButton
          description={t("options")}
          icon={OptionsIcon}
          onClick={() => setOpenOptions(true)}
        />
      )}
      {variantInfo.url && (
        <ToolButton
          description={t("openUrl")}
          icon={WebIcon}
          onClick={() => actions.openVariantURL(packageId, variantId)}
        />
      )}
      {variantInfo.repository && (
        <ToolButton
          description={t("openRepository")}
          icon={GitHubIcon}
          onClick={() => actions.openVariantRepository(packageId, variantId)}
        />
      )}
      {variantInfo.installed && (
        <ToolButton
          description={t("openConfig")}
          icon={ConfigIcon}
          onClick={() => actions.openPackageConfig(packageId)}
        />
      )}
      {variantInfo.installed && (
        <ToolButton
          description={t("openFiles")}
          icon={FilesIcon}
          onClick={() => actions.openPackageFile(packageId, variantId, "")}
        />
      )}
      {variantInfo.installed && docsPath && (
        <ToolButton
          description={t("openDocs")}
          icon={DocsIcon}
          onClick={() => actions.openPackageFile(packageId, variantId, docsPath)}
        />
      )}
      {variantInfo.installed && readmePath && (
        <ToolButton
          description={t("openReadme")}
          icon={ReadmeIcon}
          onClick={() => actions.openPackageFile(packageId, variantId, readmePath)}
        />
      )}
    </FlexBox>
  )
}
