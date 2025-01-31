import { BedtimeOutlined as DeprecatedIcon } from "@mui/icons-material"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { PackageID } from "@common/packages"
import type { VariantID } from "@common/variants"
import { Banner } from "@components/Banner"
import { Translated } from "@components/Translated"
import { addPackage, setPackageVariant } from "@stores/actions"
import { store } from "@stores/main"
import { useNavigation } from "@utils/navigation"

export function PackageBannerDeprecated({
  packageId,
  superseded,
}: {
  packageId: PackageID
  superseded?: PackageID | VariantID
}): JSX.Element {
  const packageStatus = store.usePackageStatus(packageId)

  const supersededByPackage = !!superseded?.includes("/")
  const supersededByVariant = !!superseded && !supersededByPackage
  const otherPackageId = supersededByPackage ? (superseded as PackageID) : packageId
  const otherPackageInfo = store.usePackageInfo(otherPackageId)
  const otherVariantId = supersededByVariant ? (superseded as VariantID) : undefined
  const otherVariantInfo = store.useVariantInfo(otherPackageId, otherVariantId)

  const { t } = useTranslation("PackageBanner")
  const { openPackageView } = useNavigation()

  const action = useMemo(() => {
    if (packageStatus?.enabled) {
      if (supersededByPackage) {
        return {
          description: t("deprecated.actions.replacePackage.description", {
            packageName: otherPackageInfo.name,
          }),
          label: t("deprecated.actions.replacePackage.label"),
          onClick: () =>
            addPackage(otherPackageInfo.id, otherVariantInfo.id, {
              packages: { [packageId]: { enabled: false } },
            }),
        }
      }

      if (supersededByVariant) {
        return {
          description: t("deprecated.actions.replaceVariant.description", {
            variantName: otherVariantInfo.name,
          }),
          label: t("deprecated.actions.replaceVariant.label"),
          onClick: () => setPackageVariant(packageId, otherVariantInfo.id),
        }
      }
    }
  }, [
    otherPackageInfo,
    otherVariantInfo,
    packageId,
    packageStatus,
    supersededByPackage,
    supersededByVariant,
    t,
  ])

  const messageKey = supersededByPackage
    ? "deprecated.supersededByPackage"
    : supersededByVariant
      ? "deprecated.supersededByVariant"
      : "deprecated.message"

  return (
    <Banner
      action={action}
      color="experimental"
      icon={<DeprecatedIcon />}
      title={t("deprecated.title")}
    >
      <Translated
        i18nKey={messageKey}
        link={{
          description: t("deprecated.actions.openPackage.description"),
          onClick: () => openPackageView(otherPackageId),
        }}
        ns="PackageBanner"
        values={{ packageName: otherPackageInfo.name, variantName: otherVariantInfo.name }}
      />
    </Banner>
  )
}
