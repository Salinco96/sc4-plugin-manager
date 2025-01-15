import { BedtimeOutlined as DeprecatedIcon } from "@mui/icons-material"
import { Link } from "@mui/material"
import { Trans, useTranslation } from "react-i18next"

import type { PackageID } from "@common/packages"
import type { VariantID } from "@common/variants"
import { useNavigation } from "@utils/navigation"
import { usePackageInfo, usePackageStatus, useVariantInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"

import { useMemo } from "react"
import { PackageBanner } from "./PackageBanner"

export function PackageBannerDeprecated({
  packageId,
  superseded,
}: {
  packageId: PackageID
  superseded?: PackageID | VariantID
}): JSX.Element {
  const actions = useStoreActions()
  const packageStatus = usePackageStatus(packageId)

  const supersededByPackage = !!superseded?.includes("/")
  const supersededByVariant = !!superseded && !supersededByPackage
  const otherPackageId = supersededByPackage ? (superseded as PackageID) : packageId
  const otherPackageInfo = usePackageInfo(otherPackageId)
  const otherVariantId = supersededByVariant ? (superseded as VariantID) : undefined
  const otherVariantInfo = useVariantInfo(otherPackageId, otherVariantId)

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
            actions.addPackage(otherPackageInfo.id, otherVariantInfo.id, {
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
          onClick: () => actions.setPackageVariant(packageId, otherVariantInfo.id),
        }
      }
    }
  }, [
    actions,
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
    <PackageBanner
      action={action}
      color="experimental"
      header={t("deprecated.title")}
      icon={<DeprecatedIcon />}
    >
      <Trans
        components={{
          a: (
            <Link
              color="inherit"
              onClick={() => openPackageView(otherPackageId)}
              sx={{
                ":hover": { textDecoration: "underline" },
                cursor: "pointer",
                fontWeight: "bold",
                textDecoration: "none",
              }}
              title={t("deprecated.actions.openPackage.description")}
            />
          ),
          b: <strong />,
        }}
        i18nKey={messageKey}
        ns="PackageBanner"
        values={{ packageName: otherPackageInfo.name, variantName: otherVariantInfo.name }}
      />
    </PackageBanner>
  )
}
