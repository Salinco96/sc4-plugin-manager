import { useMemo } from "react"

import { DifferenceOutlined as ConflictIcon } from "@mui/icons-material"
import { useTranslation } from "react-i18next"

import { getFeatureLabel } from "@common/i18n"
import { Issue, type VariantIssue } from "@common/variants"
import { Banner } from "@components/Banner"
import { Translated } from "@components/Translated"
import { disablePackage, updateProfile } from "@stores/actions"
import { getPackageName, store } from "@stores/main"
import { useNavigation } from "@utils/navigation"

export function PackageBannerConflict({ issue }: { issue: VariantIssue }): JSX.Element {
  const currentProfile = store.useCurrentProfile()

  const packageNames = store.useShallow(store =>
    issue.packages?.map(id => getPackageName(store, id)),
  )
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
        if (incompatiblePackageId) {
          return {
            description: t("conflict.actions.disablePackages.description", {
              packages: packageNames?.at(0),
            }),
            label: t("conflict.actions.disablePackages.label"),
            onClick: () => disablePackage(incompatiblePackageId),
          }
        }

        if (feature) {
          return {
            description: t("conflict.actions.disableExternal.description"),
            label: t("conflict.actions.disableExternal.label"),
            onClick: async () => {
              await updateProfile(currentProfile.id, {
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
              await updateProfile(currentProfile.id, {
                options: { [option]: value },
              })
            },
          }
        }
      }
    }
  }, [currentProfile, incompatiblePackageId, issue, packageNames, t])

  return (
    <Banner action={action} icon={<ConflictIcon />} title={t("conflict.title")}>
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
