import { useMemo } from "react"

import { DifferenceOutlined as ConflictIcon } from "@mui/icons-material"
import { Link } from "@mui/material"
import { Trans, useTranslation } from "react-i18next"

import { Issue, VariantIssue } from "@common/variants"
import { useNavigation } from "@utils/navigation"
import { getPackageInfo, useCurrentProfile, useStore, useStoreActions } from "@utils/store"

import { PackageBanner } from "./PackageBanner"

export function PackageBannerConflict({ issue }: { issue: VariantIssue }): JSX.Element {
  const actions = useStoreActions()
  const currentProfile = useCurrentProfile()

  const packageNames = useStore(store => issue.packages?.map(id => getPackageInfo(store, id)?.name))
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
            onClick: () => actions.disablePackage(incompatiblePackageId),
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
  }, [actions, currentProfile, incompatiblePackageId, issue, packageNames])

  return (
    <PackageBanner action={action} header={t("conflict.title")} icon={<ConflictIcon />}>
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
        values={{ ...issue, count: packageNames?.length, packages: packageNames }}
      />
    </PackageBanner>
  )
}
