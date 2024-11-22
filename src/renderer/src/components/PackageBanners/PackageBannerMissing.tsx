import { NotListedLocation as MissingIcon } from "@mui/icons-material"
import { values } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import type { PackageID } from "@common/packages"
import type { VariantID } from "@common/variants"
import { usePackageInfo, useVariantInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerMissing({
  packageId,
  variantId,
}: {
  packageId: PackageID
  variantId: VariantID
}): JSX.Element {
  const actions = useStoreActions()

  const packageInfo = usePackageInfo(packageId)
  const variantInfo = useVariantInfo(packageId, variantId)

  const { t } = useTranslation("PackageBanner")

  const message = values(packageInfo.variants).some(variant => variant.installed)
    ? t("missing.messageVariant")
    : t("missing.messagePackage")

  return (
    <PackageBanner
      action={{
        description: t("missing.actions.install.description"),
        label: t("missing.actions.install.label"),
        onClick: () => actions.installVariant(packageInfo.id, variantInfo.id),
      }}
      header={t("missing.title")}
      icon={<MissingIcon />}
    >
      {message}
    </PackageBanner>
  )
}
