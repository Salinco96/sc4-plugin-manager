import { useTranslation } from "react-i18next"

import type { PluginsFileInfo } from "@common/plugins"
import type { BannersProps } from "@components/Banners"
import { removePluginFile } from "@stores/actions"

export function usePluginsFileBanners(
  file: PluginsFileInfo,
  path: string,
): BannersProps["banners"] {
  const { t } = useTranslation("Plugins")

  return [
    file.issues?.dllNotTopLevel && {
      action: {
        description: t("actions.removeFile.description"),
        label: t("actions.removeFile.label"),
        onClick: () => removePluginFile(path),
      },
      message: t("issues.dllNotTopLevel"),
    },
    file.issues?.unsupported && {
      action: {
        description: t("actions.removeFile.description"),
        label: t("actions.removeFile.label"),
        onClick: () => removePluginFile(path),
      },
      message: t("issues.unsupported"),
    },
  ].filter(banner => !!banner)
}
