import { Update as UpdateIcon } from "@mui/icons-material"
import { useTranslation } from "react-i18next"

import type { PackageID } from "@common/packages"
import type { VariantID } from "@common/variants"
import { updateVariant } from "@stores/actions"
import { store } from "@stores/main"

import { Banner } from "../Banner"

export function PackageBannerOutdated({
  packageId,
  variantId,
}: {
  packageId: PackageID
  variantId: VariantID
}): JSX.Element {
  const packageInfo = store.usePackageInfo(packageId)
  const variantInfo = store.useVariantInfo(packageId, variantId)
  const newVersion = variantInfo.update?.version

  const { t } = useTranslation("PackageBanner")

  return (
    <Banner
      action={{
        description: t("outdated.actions.update.description", { version: newVersion }),
        label: t("outdated.actions.update.label"),
        onClick: () => updateVariant(packageInfo.id, variantInfo.id),
      }}
      icon={<UpdateIcon />}
      title={t("outdated.title")}
    >
      {t("outdated.message")}
    </Banner>
  )
}
