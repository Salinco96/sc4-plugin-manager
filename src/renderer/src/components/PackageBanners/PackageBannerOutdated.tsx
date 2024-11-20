import { Update as UpdateIcon } from "@mui/icons-material"
import { useTranslation } from "react-i18next"

import type { PackageID } from "@common/packages"
import type { VariantID } from "@common/variants"
import { usePackageInfo, useVariantInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerOutdated({
  packageId,
  variantId,
}: {
  packageId: PackageID
  variantId: VariantID
}): JSX.Element {
  const actions = useStoreActions()

  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useVariantInfo(packageId, variantId)
  const newVersion = variantInfo.update?.version

  const { t } = useTranslation("PackageBanner")

  return (
    <PackageBanner
      action={{
        description: t("outdated.actions.update.description", { version: newVersion }),
        label: t("outdated.actions.update.label"),
        onClick: () => actions.updatePackage(packageInfo.id, variantInfo.id),
      }}
      header={t("outdated.title")}
      icon={<UpdateIcon />}
    >
      {t("outdated.message")}
    </PackageBanner>
  )
}
