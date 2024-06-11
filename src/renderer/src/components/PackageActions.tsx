import { useMemo, useRef, useState } from "react"

import { MoreVert as MoreOptionsIcon } from "@mui/icons-material"
import { Box, Button, Divider, Menu, MenuItem, Select, Tooltip } from "@mui/material"

import { usePackageInfo, usePackageStatus } from "@renderer/utils/packages"
import { useCurrentProfile, useStoreActions } from "@renderer/utils/store"

interface PackageAction {
  color?: "error" | "success" | "warning"
  description?: string
  disabled?: boolean
  id: string
  label: string
  onClick: () => void
}

export function PackageActions({ packageId }: { packageId: string }): JSX.Element | null {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [isMenuOpen, setMenuOpen] = useState(false)

  const actions = useStoreActions()
  const currentProfile = useCurrentProfile()
  const packageInfo = usePackageInfo(packageId)
  const packageStatus = usePackageStatus(packageId)
  const variantId = packageStatus.variantId

  const compatibleVariants = Object.keys(packageInfo.variants).filter(
    variantId => !packageStatus.issues[variantId]?.length,
  )

  const variantInfo = packageInfo.variants[variantId]

  const packageActions = useMemo(() => {
    const packageActions: PackageAction[] = []

    const nRequires = packageStatus.requiredBy?.length ?? 0

    const isBusy = !!variantInfo?.action
    const isEnabled = !!packageStatus.enabled
    const isIncompatible = !!packageStatus.issues[variantId]?.length
    const isInstalled = !!variantInfo.installed
    const isRequired = nRequires !== 0

    if (currentProfile && isEnabled && !isInstalled) {
      packageActions.push({
        color: "warning",
        description: isIncompatible
          ? "This variant is not compatible with your profile"
          : "Install this package",
        disabled: isBusy || isIncompatible,
        id: "install",
        label: "Install",
        onClick: () => actions.addPackage(packageId, variantId),
      })
    } else if (variantInfo.update) {
      packageActions.push({
        color: "warning",
        description: isIncompatible
          ? "This variant is not compatible with your profile"
          : `Update to version ${variantInfo.update.version}`,
        disabled: isBusy || isIncompatible,
        id: "update",
        label: "Update",
        onClick: () => actions.updatePackage(packageId, variantId),
      })
    }

    if (currentProfile && isEnabled) {
      packageActions.push({
        color: "error",
        description: isRequired
          ? `This package cannot be disabled because it is required by ${nRequires} other package(s)`
          : "Disable this package",
        disabled: isBusy || isRequired,
        id: "disable",
        label: "Disable",
        onClick: () => actions.disablePackage(packageId),
      })
    }

    if (currentProfile && isInstalled && !isEnabled) {
      packageActions.push({
        color: "success",
        description: isIncompatible
          ? "This variant is not compatible with your profile"
          : "Enable this package",
        disabled: isBusy || isIncompatible,
        id: "enable",
        label: "Enable",
        onClick: () => actions.enablePackage(packageId),
      })
    }

    if (isInstalled) {
      // TODO: Only allows removing if not used by any profile
      packageActions.push({
        color: "error",
        description:
          "Remove this package\nWARNING: This package may be required by another profile!",
        disabled: isBusy || isRequired,
        id: "remove",
        label: "Remove",
        onClick: () => actions.removePackage(packageId, variantId),
      })
    }

    if (currentProfile && !isInstalled) {
      packageActions.push({
        description: "Install and enable this package",
        disabled: isBusy || isIncompatible,
        id: "add",
        label: "Add",
        onClick: () => actions.addPackage(packageId, variantId),
      })
    }

    if (!isInstalled && !isEnabled) {
      packageActions.push({
        description: "Download this package without enabling it",
        disabled: isBusy || isIncompatible,
        id: "download",
        label: "Download",
        onClick: () => actions.installPackage(packageId, variantId),
      })
    }

    return packageActions
  }, [currentProfile, packageId, variantId, variantInfo])

  if (!packageActions.length) {
    return null
  }

  const mainAction = packageActions[0]
  const moreActions = packageActions.slice(1).filter(action => !action.disabled)
  const hasMore = !!moreActions.length && !mainAction.disabled

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, width: 160 }}>
      <Box sx={{ display: "flex" }}>
        <Tooltip placement="left" title={mainAction.description}>
          <span>
            <Button
              color={mainAction.color}
              disabled={mainAction.disabled}
              onClick={mainAction.onClick}
              ref={anchorRef}
              sx={{ height: 40, paddingRight: hasMore ? 5.5 : 2, width: 160 }}
              variant="contained"
            >
              {mainAction.label}
            </Button>
          </span>
        </Tooltip>
        {hasMore && (
          <>
            <Button
              aria-label="More options"
              color={mainAction.color}
              onClick={() => setMenuOpen(true)}
              size="small"
              sx={{
                borderLeftColor: "white",
                borderLeftStyle: "solid",
                borderRadius: "0 4px 4px 0",
                boxShadow: "none !important",
                display: "flex",
                marginLeft: "-28px !important",
                minWidth: 0,
                padding: 0,
                height: 40,
              }}
              variant="contained"
            >
              <Divider color="white" orientation="vertical" />
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
          </>
        )}
      </Box>
      {(Object.keys(packageInfo.variants).length > 1 || !packageInfo.variants.default) && (
        <Select
          disabled={
            !currentProfile ||
            compatibleVariants.length === 0 ||
            (compatibleVariants.length === 1 && variantId === compatibleVariants[0])
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
          {Object.entries(packageInfo.variants).map(([id, variant]) => (
            <MenuItem key={id} value={id} disabled={!compatibleVariants.includes(id)}>
              {variant.name}
            </MenuItem>
          ))}
        </Select>
      )}
    </Box>
  )
}
