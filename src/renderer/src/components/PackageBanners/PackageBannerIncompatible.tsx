import { useMemo } from "react"

import { DoDisturb as IncompatibleIcon } from "@mui/icons-material"
import { useTranslation } from "react-i18next"

import { Issue, VariantIssue } from "@common/types"
import { getPackageInfo, useCurrentProfile, useStore, useStoreActions } from "@utils/store"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerIncompatible({
  issue,
  packageId,
  variantId,
}: {
  issue: VariantIssue
  packageId: string
  variantId: string
}): JSX.Element {
  const actions = useStoreActions()
  const currentProfile = useCurrentProfile()

  const packageNames = useStore(store => issue.packages?.map(id => getPackageInfo(store, id)?.name))

  const { t } = useTranslation("PackageBanner")

  const action = useMemo(() => {
    const { id, feature, option, packages, value } = issue
    if (!currentProfile) {
      return
    }

    switch (id) {
      case Issue.CONFLICTING_FEATURE:
      case Issue.INCOMPATIBLE_FEATURE: {
        if (packages?.length) {
          const conflictPackageId = packages[0]
          return {
            description: t("incompatible.actions.replacePackages.description", {
              packageName: packageNames?.at(0),
            }),
            label: t("incompatible.actions.replacePackages.label"),
            onClick: async () => {
              await actions.addPackage(packageId, variantId, {
                packages: { [conflictPackageId]: { enabled: false } },
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
  }, [actions, currentProfile, issue, packageNames])

  return (
    <PackageBanner
      action={action}
      color="incompatible"
      header={t("incompatible.title")}
      icon={<IncompatibleIcon />}
    >
      {t(issue.id, { ns: "Issue", ...issue, count: packageNames?.length, packages: packageNames })}
    </PackageBanner>
  )
}
