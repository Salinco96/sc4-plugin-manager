import { sortBy } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import type { PluginsFileInfo } from "@common/plugins"
import type { BannerAction } from "@components/Banner"
import type { BannersProps } from "@components/Banners"
import { TextLink } from "@components/TextLink"
import { removePluginFile } from "@stores/actions"
import { store } from "@stores/main"
import { setActiveTab } from "@stores/ui"
import { Page, useNavigation } from "@utils/navigation"

export function usePluginsFileBanners(
  file: PluginsFileInfo,
  path: string,
): BannersProps["banners"] {
  const packages = store.usePackages()

  const { openPackageView } = useNavigation()
  const { t } = useTranslation("Plugins")

  const removeAction: BannerAction = {
    description: t("actions.removeFile.description"),
    label: t("actions.removeFile.label"),
    onClick: () => removePluginFile(path),
  }

  return [
    file.issues?.conflictingPackages && {
      action: removeAction,
      message: (
        <>
          {t("issues.conflictingPackages_1")}
          <ul style={{ margin: 0, paddingInlineStart: "2rem" }}>
            {sortBy(
              file.issues.conflictingPackages
                .map(packageId => packages?.[packageId])
                .filter(packageInfo => !!packageInfo),
              packageInfo => packageInfo.name,
            ).map(packageInfo => (
              <li key={packageInfo.id}>
                <TextLink
                  description="Open package view"
                  onClick={() => {
                    setActiveTab(Page.PackageView, "files")
                    openPackageView(packageInfo.id)
                  }}
                >
                  {packageInfo.name}
                </TextLink>
              </li>
            ))}
          </ul>
          <br />
          {t("issues.conflictingPackages_2")}
        </>
      ),
    },
    file.issues?.dllNotTopLevel && {
      action: removeAction,
      message: t("issues.dllNotTopLevel"),
    },
    file.issues?.unsupported && {
      action: removeAction,
      message: t("issues.unsupported"),
    },
  ].filter(banner => !!banner)
}
