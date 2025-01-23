import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  type PackageID,
  isEnabled,
  isIncluded,
  isIncompatible,
  isInstalled,
  isInvalid,
  isMissing,
  isOutdated,
  isRequired,
} from "@common/packages"
import type { VariantID } from "@common/variants"
import { getWarningMessage } from "@common/warnings"
import { store } from "@stores/main"
import { getOrderedVariants } from "@utils/packages"

import {
  addPackage,
  disablePackage,
  enablePackage,
  installVariant,
  removeVariant,
  setPackageVariant,
  updateVariant,
} from "@stores/actions"
import { type Action, ActionButton, type Variant } from "./ActionButton"

export function PackageActions({
  filtered,
  packageId,
}: {
  filtered?: boolean
  packageId: PackageID
}): JSX.Element | null {
  const { t } = useTranslation("PackageActions")

  const currentProfile = store.useCurrentProfile()
  const packageInfo = store.usePackageInfo(packageId)
  const packageStatus = store.usePackageStatus(packageId)
  const variantInfo = store.useCurrentVariant(packageId)
  const variantId = variantInfo.id

  const filteredVariantIds = store.useFilteredVariants(packageId)

  const variants = useMemo(() => {
    const variants = getOrderedVariants(packageInfo).filter(
      variant => !filtered || variant.id === variantId || filteredVariantIds.includes(variant.id),
    )

    if (variants.length === 1 && variants[0].id === "default") {
      return
    }

    const allDeprecated = variants.every(variant => variant.deprecated)

    return variants.map<Variant<VariantID>>(variant => {
      const name = variant.name ?? variant.id

      return {
        disabled: isInvalid(variant, packageStatus),
        id: variant.id,
        label: variant.deprecated && !allDeprecated ? `${name} (Legacy)` : name,
      }
    })
  }, [filtered, filteredVariantIds, packageInfo, packageStatus, variantId])

  const packageActions = useMemo(() => {
    const packageActions: Action[] = []

    const enabled = isEnabled(packageStatus)
    const included = isIncluded(packageStatus)
    const incompatible = isIncompatible(variantInfo, packageStatus)
    const installed = isInstalled(variantInfo)
    const required = isRequired(packageStatus)

    const enableWarning = variantInfo.warnings?.find(warning => warning.on === "enable")
    const disableWarning = variantInfo.warnings?.find(warning => warning.on === "disable")

    if (isMissing(variantInfo, packageStatus)) {
      packageActions.push({
        action: () => addPackage(packageId, variantId),
        color: "warning",
        description: t("install.description"),
        id: "install",
        label: t("install.label"),
      })
    } else if (isOutdated(variantInfo)) {
      packageActions.push({
        action: () => updateVariant(packageId, variantId),
        color: "warning",
        description: t("update.description", { version: variantInfo.update?.version }),
        id: "update",
        label: t("update.label"),
      })
    }

    if (enabled) {
      packageActions.push({
        action: () => disablePackage(packageId),
        color: "error",
        description: required
          ? t("disable.reason.required", { count: packageStatus?.requiredBy?.length })
          : disableWarning
            ? getWarningMessage(disableWarning)
            : t("disable.description"),
        id: "disable",
        label: t("disable.label"),
      })
    } else if (installed) {
      packageActions.push({
        action: () => enablePackage(packageId),
        color: "success",
        description: incompatible
          ? t("enable.reason.incompatible")
          : enableWarning
            ? getWarningMessage(enableWarning)
            : t("enable.description"),
        disabled: incompatible,
        id: "enable",
        label: t("enable.label"),
      })
    }

    if (installed) {
      // TODO: Only allow removing if not used by ANY profile
      packageActions.push({
        action: async () => {
          if (!enabled || (await disablePackage(packageId))) {
            await removeVariant(packageId, variantId)
          }
        },
        color: "error",
        description: required
          ? t("remove.reason.required", { count: packageStatus?.requiredBy?.length })
          : disableWarning
            ? getWarningMessage(disableWarning)
            : t("remove.description"),
        disabled: required,
        id: "remove",
        label: t("remove.label"),
      })
    } else if (!included) {
      if (currentProfile) {
        packageActions.push({
          action: () => addPackage(packageId, variantId),
          description: incompatible
            ? t("add.reason.incompatible")
            : enableWarning
              ? getWarningMessage(enableWarning)
              : t("add.description"),
          disabled: incompatible,
          id: "add",
          label: t("add.label"),
        })
      }

      packageActions.push({
        action: () => installVariant(packageId, variantId),
        description: t("download.description"),
        id: "download",
        label: t("download.label"),
      })
    }

    return packageActions
  }, [currentProfile, packageId, packageStatus, t, variantId, variantInfo])

  const loadingLabel = useMemo(() => {
    if (variantInfo.action) {
      return t(`actions.${variantInfo.action}`)
    }

    if (packageStatus?.action && packageStatus.action !== "switching") {
      return t(`actions.${packageStatus.action}`)
    }
  }, [packageStatus, t, variantInfo])

  return (
    <ActionButton
      actions={packageActions}
      isLoading={!!loadingLabel}
      loadingLabel={loadingLabel}
      setVariant={variantId => setPackageVariant(packageInfo.id, variantId)}
      variant={variantId}
      variants={variants}
      variantLoading={packageStatus?.action === "switching"}
    />
  )
}
