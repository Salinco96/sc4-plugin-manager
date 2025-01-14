import { useState } from "react"

import {
  Settings as ConfigIcon,
  Topic as DocsIcon,
  Folder as FilesIcon,
  GitHub as GitHubIcon,
  Tune as OptionsIcon,
  Notes as ReadmeIcon,
  LiveHelpOutlined as SupportIcon,
  Language as WebIcon,
} from "@mui/icons-material"
import { useTranslation } from "react-i18next"

import type { PackageID } from "@common/packages"
import type { VariantID } from "@common/variants"
import { FlexRow } from "@components/FlexBox"
import { PackageOptionsDialog } from "@components/Options/PackageOptionsDialog"
import { useVariantInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"
import { ToolButton } from "./ToolButton"

export function PackageTools({
  packageId,
  variantId,
}: {
  packageId: PackageID
  variantId?: VariantID
}): JSX.Element {
  const actions = useStoreActions()
  const variantInfo = useVariantInfo(packageId, variantId)

  const docsPath = variantInfo.docs
  const readmePaths = variantInfo.readme

  const [openOptions, setOpenOptions] = useState(false)

  const { t } = useTranslation("ToolBelt")

  const hasOptions = !!variantInfo.options?.length

  return (
    <FlexRow centered gap={0.5} mx={0.5}>
      <PackageOptionsDialog
        onClose={() => setOpenOptions(false)}
        open={openOptions}
        packageId={packageId}
      />
      {hasOptions && !variantId && (
        <ToolButton
          description={t("options")}
          icon={OptionsIcon}
          onClick={() => setOpenOptions(true)}
        />
      )}
      {variantInfo.url && (
        <ToolButton
          description={t(variantInfo.url.includes("simtropolis") ? "openSimtropolis" : "openUrl")}
          icon={WebIcon}
          onClick={() => actions.openPackageURL(packageId, variantInfo.id, "url")}
        />
      )}
      {variantInfo.repository && (
        <ToolButton
          description={t("openRepository")}
          icon={GitHubIcon}
          onClick={() => actions.openPackageURL(packageId, variantInfo.id, "repository")}
        />
      )}
      {variantInfo.support && (
        <ToolButton
          description={t("openSupport")}
          icon={SupportIcon}
          onClick={() => actions.openPackageURL(packageId, variantInfo.id, "support")}
        />
      )}
      {variantInfo.installed && !variantId && (
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
          onClick={() => actions.openPackageFile(packageId, variantInfo.id, "")}
        />
      )}
      {variantInfo.installed && docsPath && (
        <ToolButton
          description={t("openDocs")}
          icon={DocsIcon}
          onClick={() => actions.openPackageFile(packageId, variantInfo.id, docsPath)}
        />
      )}
      {variantInfo.installed && readmePaths?.length && (
        <ToolButton
          description={t("openReadme")}
          icon={ReadmeIcon}
          onClick={() => actions.openPackageFile(packageId, variantInfo.id, readmePaths[0])}
        />
      )}
    </FlexRow>
  )
}
