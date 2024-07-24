import { useMemo } from "react"

import { useTranslation } from "react-i18next"

import { Issue, VariantIssue } from "@common/types"
import { getPackageInfo, useCurrentProfile, useStore, useStoreActions } from "@utils/store"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerConflict({ issue }: { issue: VariantIssue }): JSX.Element {
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
            description: t("conflict.actions.disablePackages.description", {
              packages: packageNames?.at(0),
            }),
            label: t("conflict.actions.disablePackages.label"),
            onClick: () => actions.disablePackage(conflictPackageId),
          }
        }

        if (feature) {
          return {
            description: t("conflict.actions.disableExternal.description"),
            label: t("conflict.actions.disableExternal.label"),
            onClick: async () => {
              await actions.updateProfile(currentProfile.id, {
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
    <PackageBanner action={action} header={t("conflict.title")}>
      {t(issue.id, {
        ns: "Issue",
        ...issue,
        count: packageNames?.length,
        option: issue.option,
        packages: packageNames,
        value: issue.value,
      })}
    </PackageBanner>
  )
}
