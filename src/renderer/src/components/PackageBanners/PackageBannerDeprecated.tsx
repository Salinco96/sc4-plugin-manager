import { BedtimeOutlined as DeprecatedIcon } from "@mui/icons-material"
import { Link } from "@mui/material"
import { Trans, useTranslation } from "react-i18next"

import { PackageID } from "@common/packages"
import { useNavigation } from "@utils/navigation"
import { useCurrentVariant, usePackageInfo, usePackageStatus } from "@utils/packages"
import { useStoreActions } from "@utils/store"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerDeprecated({
  packageId,
  superseded,
}: {
  packageId: PackageID
  superseded?: PackageID
}): JSX.Element {
  const actions = useStoreActions()
  const packageInfo = usePackageInfo(superseded ?? packageId)
  const packageStatus = usePackageStatus(packageId)
  const variantInfo = useCurrentVariant(superseded ?? packageId)

  const { t } = useTranslation("PackageBanner")
  const { openPackageView } = useNavigation()

  return (
    <PackageBanner
      action={
        superseded && packageStatus?.enabled
          ? {
              description: t("deprecated.actions.replacePackage.description", {
                packageName: packageInfo.name,
              }),
              label: t("deprecated.actions.replacePackage.label"),
              onClick: () =>
                actions.addPackage(superseded, variantInfo.id, {
                  packages: { [packageId]: { enabled: false } },
                }),
            }
          : undefined
      }
      color="experimental"
      header={t("deprecated.title")}
      icon={<DeprecatedIcon />}
    >
      <Trans
        components={{
          a: (
            <Link
              color="inherit"
              onClick={() => openPackageView(superseded ?? packageId)}
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
        i18nKey={superseded ? "deprecated.messageSuperseded" : "deprecated.message"}
        ns="PackageBanner"
        values={{ packageName: packageInfo.name }}
      />
    </PackageBanner>
  )
}
