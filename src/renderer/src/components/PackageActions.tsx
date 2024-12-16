import { MoreVert as MoreOptionsIcon } from "@mui/icons-material"
import { Box, Button, Divider, Menu, MenuItem, Select, Tooltip } from "@mui/material"
import { keys } from "@salinco/nice-utils"
import { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  type PackageID,
  isDisabled,
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
import {
  useCurrentVariant,
  useFilteredVariants,
  usePackageInfo,
  usePackageStatus,
} from "@utils/packages"
import { useCurrentProfile, useStoreActions } from "@utils/store"

import { FlexBox } from "./FlexBox"

interface PackageAction {
  color?: "error" | "info" | "success" | "warning"
  description?: string
  disabled?: boolean
  id: string
  label: string
  onClick: () => void
}

export function PackageActions({
  filtered,
  packageId,
}: {
  filtered?: boolean
  packageId: PackageID
}): JSX.Element | null {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [isMenuOpen, setMenuOpen] = useState(false)

  const { t } = useTranslation("PackageActions")

  const actions = useStoreActions()
  const currentProfile = useCurrentProfile()
  const packageInfo = usePackageInfo(packageId)
  const packageStatus = usePackageStatus(packageId)
  const variantInfo = useCurrentVariant(packageId)
  const variantId = variantInfo.id

  const filteredVariantIds = useFilteredVariants(packageId)

  const variantIds = useMemo(() => {
    const variantIds = keys(packageInfo.variants)

    if (filtered) {
      return variantIds.filter(id => id === variantId || filteredVariantIds.includes(id))
    }

    return variantIds
  }, [filtered, filteredVariantIds, packageInfo, variantId])

  const selectableVariantIds = useMemo(() => {
    return variantIds.filter(id => {
      const variantInfo = packageInfo.variants[id]
      return variantInfo && !isInvalid(variantInfo, packageStatus)
    })
  }, [packageInfo, packageStatus, variantIds])

  const packageActions = useMemo(() => {
    const packageActions: PackageAction[] = []

    const incompatible = isIncompatible(variantInfo, packageStatus)
    const required = isRequired(variantInfo, packageStatus)

    const enableWarning = variantInfo.warnings?.find(warning => warning.on === "enable")
    const disableWarning = variantInfo.warnings?.find(warning => warning.on === "disable")

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

    if (isEnabled(variantInfo, packageStatus)) {
      packageActions.push({
        color: "error",
        description: required
          ? t("disable.reason.required", { count: packageStatus?.requiredBy?.length })
          : disableWarning
            ? getWarningMessage(disableWarning)
            : t("disable.description"),
        id: "disable",
        label: t("disable.label"),
        onClick: () => actions.disablePackage(packageId),
      })
    } else if (isDisabled(variantInfo, packageStatus)) {
      packageActions.push({
        color: "success",
        description: incompatible
          ? t("enable.reason.incompatible")
          : enableWarning
            ? getWarningMessage(enableWarning)
            : t("enable.description"),
        disabled: incompatible,
        id: "enable",
        label: t("enable.label"),
        onClick: () => actions.enablePackage(packageId),
      })
    }

    if (isInstalled(variantInfo) && !isRequired(variantInfo, packageStatus)) {
      // TODO: Only allow removing if not used by ANY profile
      packageActions.push({
        color: "error",
        description: required
          ? t("remove.reason.required", { count: packageStatus?.requiredBy?.length })
          : disableWarning
            ? getWarningMessage(disableWarning)
            : t("remove.description"),
        disabled: required,
        id: "remove",
        label: t("remove.label"),
        onClick: async () => {
          if (!isEnabled(variantInfo, packageStatus) || (await actions.disablePackage(packageId))) {
            await actions.removeVariant(packageId, variantId)
          }
        },
      })
    }

    if (!isInstalled(variantInfo) && !isIncluded(variantInfo, packageStatus)) {
      if (currentProfile) {
        packageActions.push({
          description: incompatible
            ? t("add.reason.incompatible")
            : enableWarning
              ? getWarningMessage(enableWarning)
              : t("add.description"),
          disabled: incompatible,
          id: "add",
          label: t("add.label"),
          onClick: () => actions.addPackage(packageId, variantId),
        })
      }

      packageActions.push({
        description: t("download.description"),
        id: "download",
        label: t("download.label"),
        onClick: () => actions.installVariant(packageId, variantId),
      })
    }

    return packageActions
  }, [actions, currentProfile, packageId, packageStatus, t, variantId, variantInfo])

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
          <FlexBox ml={-3.5} sx={{ backgroundColor: "white" }} zIndex={1}>
            <Divider color={disabled ? "lightgray" : "white"} orientation="vertical" />
            <Button
              aria-label={t("more")}
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
          </FlexBox>
        )}
      </Box>
      {(Object.keys(packageInfo.variants).length > 1 ||
        !packageInfo.variants["default" as VariantID]) && (
        <Select
          disabled={
            selectableVariantIds.length === 0 ||
            (selectableVariantIds.length === 1 && variantId === selectableVariantIds[0])
          }
          fullWidth
          onClose={() => setMenuOpen(false)}
          MenuProps={{ sx: { maxHeight: 320 } }}
          name="variant"
          onChange={event =>
            actions.setPackageVariant(packageInfo.id, event.target.value as VariantID)
          }
          required
          size="small"
          value={variantId}
          variant="outlined"
        >
          {variantIds.map(id => (
            <MenuItem key={id} value={id} disabled={!selectableVariantIds.includes(id)}>
              {packageInfo.variants[id]?.name ?? id}
            </MenuItem>
          ))}
        </Select>
      )}
    </Box>
  )
}
