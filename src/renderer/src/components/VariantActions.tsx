import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  type PackageID,
  isIncluded,
  isIncompatible,
  isInstalled,
  isMissing,
  isOutdated,
  isRequired,
  isSelected,
} from "@common/packages"
import type { VariantID } from "@common/variants"
import { getWarningMessage } from "@common/warnings"
import {
  addPackage,
  installVariant,
  removeVariant,
  setPackageVariant,
  updateVariant,
} from "@stores/actions"
import { store } from "@stores/main"
import { type Action, ActionButton } from "./ActionButton"

export function VariantActions({
  packageId,
  variantId,
}: {
  packageId: PackageID
  variantId: VariantID
}): JSX.Element | null {
  const { t } = useTranslation("PackageActions")

  const packageStatus = store.usePackageStatus(packageId)
  const variantInfo = store.useVariantInfo(packageId, variantId)

  const variantActions = useMemo(() => {
    const variantActions: Action[] = []

    const selected = isSelected(variantInfo, packageStatus)
    const included = isIncluded(packageStatus)
    const incompatible = isIncompatible(variantInfo, packageStatus)
    const installed = isInstalled(variantInfo)
    const required = isRequired(packageStatus)

    if (isMissing(variantInfo, packageStatus)) {
      variantActions.push({
        action: () => addPackage(packageId, variantId),
        color: "warning",
        description: t("install.description"),
        id: "install",
        label: t("install.label"),
      })
    } else if (isOutdated(variantInfo)) {
      variantActions.push({
        action: () => updateVariant(packageId, variantId),
        color: "warning",
        description: t("update.description", { version: variantInfo.update?.version }),
        id: "update",
        label: t("update.label"),
      })
    }

    if (!selected) {
      const selectWarning = variantInfo.warnings?.find(warning => warning.on === "variant")

      variantActions.push({
        action: () => setPackageVariant(packageId, variantId),
        color: "success",
        description: incompatible
          ? t("select.reason.incompatible")
          : selectWarning
            ? getWarningMessage(selectWarning)
            : t("select.description"),
        disabled: included && incompatible,
        id: "select",
        label: t("select.label"),
      })
    }

    if (installed) {
      // TODO: Only allow removing if not used by ANY profile
      variantActions.push({
        action: () => removeVariant(packageId, variantId),
        color: "error",
        description:
          required && selected
            ? t("remove.reason.required", { count: packageStatus?.requiredBy?.length })
            : t("remove.description"),
        disabled: required && selected,
        id: "remove",
        label: t("remove.label"),
      })
    } else if (!included || !selected) {
      variantActions.push({
        action: () => installVariant(packageId, variantId),
        description: t("download.description"),
        id: "download",
        label: t("download.label"),
      })
    }

    return variantActions
  }, [packageId, packageStatus, t, variantId, variantInfo])

  const loadingLabel = useMemo(() => {
    if (variantInfo.action) {
      return t(`actions.${variantInfo.action}`)
    }

    if (variantActions[0].id === "select" && packageStatus?.action === "switching") {
      return t(`actions.${packageStatus.action}`)
    }
  }, [packageStatus, t, variantActions[0].id, variantInfo])

  return (
    <ActionButton actions={variantActions} isLoading={!!loadingLabel} loadingLabel={loadingLabel} />
  )
}
