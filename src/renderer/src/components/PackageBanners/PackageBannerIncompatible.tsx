import { useMemo } from "react"

import { DoDisturb as IncompatibleIcon } from "@mui/icons-material"
import { values } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import { getFeatureLabel } from "@common/i18n"
import type { PackageID } from "@common/packages"
import { Issue, type VariantID, type VariantIssue } from "@common/variants"
import { Banner } from "@components/Banner"
import { Translated } from "@components/Translated"
import { addPackage, check4GBPatch, updateProfile } from "@stores/actions"
import { store } from "@stores/main"
import { useNavigation } from "@utils/navigation"

export function PackageBannerIncompatible({
  issue,
  packageId,
  variantId,
}: {
  issue: VariantIssue
  packageId: PackageID
  variantId: VariantID
}): JSX.Element {
  const currentProfile = store.useCurrentProfile()
  const currentVariantId = store.useCurrentVariant(packageId).id

  const packages = store.usePackages()
  const packageNames = issue.packages?.map(id => packages?.[id]?.name ?? id)

  const incompatiblePackageId = issue.packages?.at(0)

  const { t } = useTranslation("PackageBanner")
  const { openPackageView } = useNavigation()

  const action = useMemo(() => {
    const { id, feature, option, value } = issue
    if (!currentProfile) {
      return
    }

    switch (id) {
      case Issue.MISSING_4GB_PATCH: {
        return {
          description: t("incompatible.actions.exePatch.description"),
          label: t("incompatible.actions.exePatch.label"),
          onClick: check4GBPatch,
        }
      }

      case Issue.MISSING_FEATURE: {
        if (feature && packages) {
          const featurePackages = values(packages).filter(packageInfo =>
            packageInfo.features?.includes(feature),
          )

          if (featurePackages.length === 1) {
            return {
              description: t("incompatible.actions.openPackage.description"),
              label: t("incompatible.actions.openPackage.label"),
              onClick: () => openPackageView(featurePackages[0].id),
            }
          }
        }

        break
      }

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
                await addPackage(packageId, variantId, {
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
                await addPackage(packageId, variantId, {
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
            description: t("incompatible.actions.setOption.description", { option, value }),
            label: t("incompatible.actions.setOption.label"),
            onClick: async () => {
              await updateProfile(currentProfile.id, {
                options: { [option]: value },
              })
            },
          }
        }
      }
    }
  }, [
    currentProfile,
    currentVariantId,
    incompatiblePackageId,
    issue,
    openPackageView,
    packageId,
    packageNames,
    packages,
    t,
    variantId,
  ])

  return (
    <Banner
      action={action}
      color="incompatible"
      icon={<IncompatibleIcon />}
      title={t("incompatible.title")}
    >
      <Translated
        i18nKey={issue.id}
        link={{
          description: t("deprecated.actions.openPackage.description"),
          onClick: () => incompatiblePackageId && openPackageView(incompatiblePackageId),
        }}
        ns="Issue"
        values={{
          ...issue,
          count: packageNames?.length,
          feature: issue.feature && getFeatureLabel(t, issue.feature),
          packages: packageNames,
        }}
      />
    </Banner>
  )
}
