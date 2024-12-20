import { useMemo } from "react"

import { DoDisturb as IncompatibleIcon } from "@mui/icons-material"
import { Link } from "@mui/material"
import { Trans, useTranslation } from "react-i18next"

import { getFeatureLabel } from "@common/i18n"
import type { PackageID } from "@common/packages"
import { Issue, type VariantID, type VariantIssue } from "@common/variants"
import { useNavigation } from "@utils/navigation"
import { useCurrentVariant } from "@utils/packages"
import { getPackageName, useCurrentProfile, useStore, useStoreActions } from "@utils/store"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerIncompatible({
  issue,
  packageId,
  variantId,
}: {
  issue: VariantIssue
  packageId: PackageID
  variantId: VariantID
}): JSX.Element {
  const actions = useStoreActions()
  const currentProfile = useCurrentProfile()
  const currentVariantId = useCurrentVariant(packageId).id

  const packageNames = useStore(store => issue.packages?.map(id => getPackageName(store, id)))
  const incompatiblePackageId = issue.packages?.at(0)

  const { t } = useTranslation("PackageBanner")
  const { openPackageView } = useNavigation()

  const action = useMemo(() => {
    const { id, feature, option, value } = issue
    if (!currentProfile) {
      return
    }

    switch (id) {
      case Issue.CONFLICTING_FEATURE:
      case Issue.INCOMPATIBLE_FEATURE: {
        if (variantId !== currentVariantId) {
          if (incompatiblePackageId) {
            return {
              description: t("incompatible.actions.replacePackages.description", {
                packageName: packageNames?.at(0),
              }),
              label: t("incompatible.actions.replacePackages.label"),
              onClick: async () => {
                await actions.addPackage(packageId, variantId, {
                  packages: { [incompatiblePackageId]: { enabled: false } },
                })
              },
            }
          }

          if (feature) {
            return {
              description: t("incompatible.actions.replaceExternal.description"),
              label: t("incompatible.actions.replaceExternal.label"),
              onClick: async () => {
                await actions.addPackage(packageId, variantId, {
                  features: { [feature]: false },
                })
              },
            }
          }
        }

        break
      }

      case Issue.INCOMPATIBLE_OPTION: {
        if (option) {
          return {
            description: t("conflict.actions.setOption.description", { option, value }),
            label: t("conflict.actions.setOption.label"),
            onClick: async () => {
              await actions.updateProfile(currentProfile.id, {
                options: { [option]: value },
              })
            },
          }
        }
      }
    }
  }, [
    actions,
    currentProfile,
    currentVariantId,
    incompatiblePackageId,
    issue,
    packageId,
    packageNames,
    t,
    variantId,
  ])

  return (
    <PackageBanner
      action={action}
      color="incompatible"
      header={t("incompatible.title")}
      icon={<IncompatibleIcon />}
    >
      <Trans
        components={{
          a: (
            <Link
              color="inherit"
              onClick={() => {
                if (incompatiblePackageId) {
                  openPackageView(incompatiblePackageId)
                }
              }}
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
        i18nKey={issue.id}
        ns="Issue"
        values={{
          ...issue,
          count: packageNames?.length,
          feature: issue.feature && getFeatureLabel(t, issue.feature),
          packages: packageNames,
        }}
      />
    </PackageBanner>
  )
}
