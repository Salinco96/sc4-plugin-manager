import { useMemo, useRef, useState } from "react"

import { MoreVert as MoreOptionsIcon } from "@mui/icons-material"
import { Box, Button, Divider, Menu, MenuItem, Tooltip } from "@mui/material"
import { useTranslation } from "react-i18next"

import {
  type PackageID,
  isEnabled,
  isIncluded,
  isIncompatible,
  isInstalled,
  isMissing,
  isOutdated,
  isRequired,
} from "@common/packages"
import type { VariantID } from "@common/variants"
import { getWarningMessage } from "@common/warnings"
import { usePackageStatus, useVariantInfo } from "@utils/packages"
import { useStoreActions } from "@utils/store"

import { FlexRow } from "./FlexBox"

interface PackageAction {
  color?: "error" | "info" | "success" | "warning"
  description?: string
  disabled?: boolean
  id: string
  label: string
  onClick: () => void
}

export function VariantActions({
  packageId,
  variantId,
}: {
  packageId: PackageID
  variantId: VariantID
}): JSX.Element | null {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [isMenuOpen, setMenuOpen] = useState(false)

  const { t } = useTranslation("PackageActions")

  const actions = useStoreActions()
  const packageStatus = usePackageStatus(packageId)
  const variantInfo = useVariantInfo(packageId, variantId)

  const packageActions = useMemo(() => {
    const packageActions: PackageAction[] = []

    const isSelected = variantId === packageStatus?.variantId
    const incompatible = isIncompatible(variantInfo, packageStatus)
    const required = isRequired(variantInfo, packageStatus)

    if (isMissing(variantInfo)) {
      packageActions.push({
        color: "warning",
        description: t("install.description"),
        id: "install",
        label: t("install.label"),
        onClick: () => actions.addPackage(packageId, variantId),
      })
    } else if (isOutdated(variantInfo)) {
      packageActions.push({
        color: "warning",
        description: t("update.description", { version: variantInfo.update?.version }),
        id: "update",
        label: t("update.label"),
        onClick: () => actions.updatePackage(packageId, variantId),
      })
    }

    if (!isSelected) {
      const selectWarning = variantInfo.warnings?.find(warning => warning.on === "variant")

      packageActions.push({
        color: "success",
        description: incompatible
          ? t("select.reason.incompatible")
          : selectWarning
            ? getWarningMessage(selectWarning)
            : t("select.description"),
        disabled: !!packageStatus?.included && incompatible,
        id: "select",
        label: t("select.label"),
        onClick: () => actions.setPackageVariant(packageId, variantId),
      })
    }

    if (isInstalled(variantInfo) && !isRequired(variantInfo, packageStatus)) {
      // TODO: Only allow removing if not used by ANY profile
      packageActions.push({
        color: "error",
        description: required
          ? t("remove.reason.required", { count: packageStatus?.requiredBy?.length })
          : t("remove.description"),
        disabled: isEnabled(variantInfo, packageStatus) || required,
        id: "remove",
        label: t("remove.label"),
        onClick: () => actions.removeVariant(packageId, variantId),
      })
    }

    if (!isInstalled(variantInfo) && !isIncluded(variantInfo, packageStatus)) {
      packageActions.push({
        description: t("download.description"),
        id: "download",
        label: t("download.label"),
        onClick: () => actions.installVariant(packageId, variantId),
      })
    }

    return packageActions
  }, [actions, packageId, packageStatus, t, variantId, variantInfo])

  if (!packageActions.length) {
    return null
  }

  const mainAction = packageActions[0]
  const moreActions = packageActions.slice(1).filter(action => !action.disabled)
  const hasMore = !!moreActions.length && !mainAction.disabled
  const disabled = !!mainAction.disabled || !!packageStatus?.action || !!variantInfo.action

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, width: 160 }}>
      <Box sx={{ display: "flex" }}>
        <Tooltip placement="left" title={mainAction.description}>
          <span>
            <Button
              color={mainAction.color}
              disabled={disabled}
              onClick={mainAction.onClick}
              ref={anchorRef}
              sx={{ height: 40, paddingRight: hasMore ? 5.5 : 2, width: 160 }}
              variant="contained"
            >
              {variantInfo.action
                ? t(`actions.${variantInfo.action}`)
                : packageStatus?.action
                  ? t(`actions.${packageStatus.action}`)
                  : mainAction.label}
            </Button>
          </span>
        </Tooltip>

        {hasMore && (
          <FlexRow bgcolor="white" ml={-3.5} zIndex={1}>
            <Divider color={disabled ? "lightgray" : "white"} orientation="vertical" />
            <Button
              aria-label={t("more", { ns: "General" })}
              color={mainAction.color}
              disabled={disabled}
              onClick={() => setMenuOpen(true)}
              size="small"
              sx={{
                borderRadius: "0 4px 4px 0",
                boxShadow: "none !important",
                minWidth: 0,
                padding: 0,
              }}
              variant="contained"
            >
              <MoreOptionsIcon color="inherit" fontSize="small" sx={{ margin: 0.5 }} />
            </Button>
            <Menu
              anchorEl={anchorRef.current}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              open={isMenuOpen}
              onClose={() => setMenuOpen(false)}
              slotProps={{ paper: { sx: { minWidth: anchorRef.current?.offsetWidth } } }}
            >
              {moreActions.map(action => (
                <Tooltip placement="left" key={action.id} title={action.description}>
                  <MenuItem
                    disabled={action.disabled}
                    onClick={() => {
                      action.onClick()
                      setMenuOpen(false)
                    }}
                  >
                    {action.label}
                  </MenuItem>
                </Tooltip>
              ))}
            </Menu>
          </FlexRow>
        )}
      </Box>
    </Box>
  )
}
