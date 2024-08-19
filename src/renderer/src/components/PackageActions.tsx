import { useMemo, useRef, useState } from "react"

import { MoreVert as MoreOptionsIcon } from "@mui/icons-material"
import { Box, Button, Divider, Menu, MenuItem, Select, Tooltip } from "@mui/material"
import { useTranslation } from "react-i18next"

import { isIncompatible } from "@common/packages"
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

export function PackageActions({ packageId }: { packageId: string }): JSX.Element | null {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [isMenuOpen, setMenuOpen] = useState(false)

  const { t } = useTranslation("PackageActions")

  const actions = useStoreActions()
  const currentProfile = useCurrentProfile()
  const packageConfig = currentProfile?.packages[packageId]
  const packageInfo = usePackageInfo(packageId)
  const packageStatus = usePackageStatus(packageId)
  const variantInfo = useCurrentVariant(packageId)
  const variantIds = useFilteredVariants(packageId)
  const variantId = variantInfo.id

  const selectableVariantIds = packageStatus?.enabled
    ? variantIds.filter(
        variantId => !isIncompatible(packageInfo.variants[variantId], packageStatus),
      )
    : variantIds

  const packageActions = useMemo(() => {
    const packageActions: PackageAction[] = []

    const isEnabled = !!packageStatus?.enabled
    const isExplicitlyEnabled = isEnabled && packageConfig?.enabled
    const isImplicitlyEnabled = isEnabled && !packageConfig?.enabled
    const isIncompatible = !!packageStatus?.issues?.[variantId]?.length
    const isInstalled = !!variantInfo.installed
    const isRequired = !!packageStatus?.requiredBy?.length

    if (currentProfile && isEnabled && !isInstalled) {
      packageActions.push({
        color: "warning",
        description: isIncompatible ? t("install.reason.incompatible") : t("install.description"),
        disabled: isIncompatible,
        id: "install",
        label: t("install.label"),
        onClick: () => actions.addPackage(packageId, variantId),
      })
    } else if (variantInfo.update) {
      packageActions.push({
        color: "warning",
        description: isIncompatible
          ? t("update.reason.incompatible")
          : t("update.description", { version: variantInfo.update.version }),
        disabled: isIncompatible,
        id: "update",
        label: t("update.label"),
        onClick: () => actions.updatePackage(packageId, variantId),
      })
    }

    if (currentProfile && isExplicitlyEnabled) {
      packageActions.push({
        color: "error",
        description: isRequired
          ? t("disable.reason.required", { count: packageStatus?.requiredBy?.length })
          : t("disable.description"),
        id: "disable",
        label: t("disable.label"),
        onClick: () => actions.disablePackage(packageId),
      })
    }

    if (currentProfile && isInstalled && !isExplicitlyEnabled) {
      packageActions.push({
        color: "success",
        description: isIncompatible ? t("enable.reason.incompatible") : t("enable.description"),
        disabled: isIncompatible,
        id: "enable",
        label: t("enable.label"),
        onClick: () => actions.enablePackage(packageId),
      })
    }

    if (isInstalled && !isImplicitlyEnabled) {
      // TODO: Only allows removing if not used by any profile
      packageActions.push({
        color: "error",
        description: isRequired
          ? t("remove.reason.required", { count: packageStatus?.requiredBy?.length })
          : t("remove.description"),
        disabled: isRequired,
        id: "remove",
        label: t("remove.label"),
        onClick: () => actions.removePackage(packageId, variantId),
      })
    }

    if (currentProfile && !isInstalled && !isEnabled) {
      packageActions.push({
        description: isIncompatible ? t("add.reason.incompatible") : t("add.description"),
        disabled: isIncompatible,
        id: "add",
        label: t("add.label"),
        onClick: () => actions.addPackage(packageId, variantId),
      })
    }

    if (!isInstalled && !isEnabled) {
      packageActions.push({
        description: t("download.description"),
        id: "download",
        label: t("download.label"),
        onClick: () => actions.installPackage(packageId, variantId),
      })
    }

    return packageActions
  }, [currentProfile, packageConfig, packageId, t, variantId, variantInfo])

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
      {(Object.keys(packageInfo.variants).length > 1 || !packageInfo.variants.default) && (
        <Select
          disabled={
            selectableVariantIds.length === 0 ||
            (selectableVariantIds.length === 1 && variantId === selectableVariantIds[0])
          }
          fullWidth
          MenuProps={{ onClose: () => setMenuOpen(false), sx: { maxHeight: 320 } }}
          name="variant"
          onChange={event => actions.setPackageVariant(packageInfo.id, event.target.value)}
          required
          size="small"
          value={variantId}
          variant="outlined"
        >
          {variantIds.map(id => (
            <MenuItem key={id} value={id} disabled={!selectableVariantIds.includes(id)}>
              {packageInfo.variants[id].name}
            </MenuItem>
          ))}
        </Select>
      )}
    </Box>
  )
}
