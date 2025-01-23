import { NotListedLocation as MissingIcon } from "@mui/icons-material"
import { values } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import type { PackageID } from "@common/packages"
import type { VariantID } from "@common/variants"
import { installVariant } from "@stores/actions"
import { store } from "@stores/main"

import { Banner } from "../Banner"

export function PackageBannerMissing({
  packageId,
  variantId,
}: {
  packageId: PackageID
  variantId: VariantID
}): JSX.Element {
  const packageInfo = store.usePackageInfo(packageId)
  const variantInfo = store.useVariantInfo(packageId, variantId)

  const { t } = useTranslation("PackageBanner")

  const message = values(packageInfo.variants).some(variant => variant.installed)
    ? t("missing.messageVariant")
    : t("missing.messagePackage")

  return (
    <Banner
      action={{
        description: t("missing.actions.install.description"),
        label: t("missing.actions.install.label"),
        onClick: () => installVariant(packageInfo.id, variantInfo.id),
      }}
      icon={<MissingIcon />}
      title={t("missing.title")}
    >
      {message}
    </Banner>
  )
}
