import { useMemo, useRef, useState } from "react"

import MoreOptionsIcon from "@mui/icons-material/MoreVert"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Divider from "@mui/material/Divider"
import Menu from "@mui/material/Menu"
import MenuItem from "@mui/material/MenuItem"
import Select from "@mui/material/Select"
import Tooltip from "@mui/material/Tooltip"

import { PackageInfo } from "@common/types"
import { useCurrentProfile, useStoreActions } from "@renderer/utils/store"

interface PackageAction {
  color?: "error" | "success" | "warning"
  description?: string
  disabled?: boolean
  id: string
  label: string
  onClick: () => void
}

export function PackageActions({
  onHover,
  onMenuOpen,
  packageInfo,
}: {
  onHover?: (hover: boolean) => void
  onMenuOpen?: () => void
  packageInfo: PackageInfo
}): JSX.Element | null {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [isMenuOpen, setMenuOpen] = useState(false)

  const actions = useStoreActions()
  const currentProfile = useCurrentProfile()
  const variant = packageInfo.status.variant

  const packageActions = useMemo(() => {
    const variantInfo = packageInfo.variants[variant]

    const packageActions: PackageAction[] = []

    const isEnabled = !!packageInfo.status.enabled
    const nRequires = packageInfo.status.requiredBy?.length ?? 0
    const isRequired = nRequires !== 0

    if (variantInfo?.installed) {
      if (variantInfo.installed !== variantInfo.version) {
        packageActions.push({
          color: "warning",
          description: `Update to version ${variantInfo.version}`,
          id: "update",
          label: "Update",
          onClick: async () => {
            await actions.installPackages([packageInfo.id])
          },
        })
      }

      if (currentProfile) {
        if (isEnabled) {
          packageActions.push({
            color: "error",
            description: isRequired
              ? `This package cannot be disabled because it is required by ${nRequires} other package(s)`
              : "Disable this package",
            disabled: isRequired,
            id: "disable",
            label: "Disable",
            onClick: async () => {
              await actions.disablePackages([packageInfo.id])
            },
          })

          // TODO: Only allows removing if not used by any other profile
          packageActions.push({
            color: "error",
            description:
              "Remove this package\nWARNING: This package may be required by another profile!",
            disabled: isRequired,
            id: "remove",
            label: "Remove",
            onClick: async () => {
              if (await actions.disablePackages([packageInfo.id])) {
                await actions.removePackages([packageInfo.id])
              }
            },
          })
        } else {
          packageActions.push({
            color: "success",
            id: "enable",
            label: "Enable",
            onClick: async () => {
              await actions.enablePackages([packageInfo.id])
            },
          })

          // TODO: Only allows removing if not used by any profile
          packageActions.push({
            color: "error",
            description:
              "Remove this package\nWARNING: This package may be required by another profile!",
            disabled: isRequired,
            id: "remove",
            label: "Remove",
            onClick: async () => {
              await actions.removePackages([packageInfo.id])
            },
          })
        }
      }
    } else if (isEnabled) {
      packageActions.push({
        color: "warning",
        description: "Fix this package",
        disabled: !variantInfo || !!variantInfo.installing,
        id: "fix",
        label: "Fix",
        onClick: async () => {
          await actions.installPackages([packageInfo.id])
        },
      })

      packageActions.push({
        color: "error",
        description: isRequired
          ? `This package cannot be disabled because it is required by ${nRequires} other package(s)`
          : "Disable this package",
        disabled: isRequired,
        id: "disable",
        label: "Disable",
        onClick: async () => {
          await actions.disablePackages([packageInfo.id])
        },
      })
    } else {
      packageActions.push({
        description: "Download and enable this package",
        disabled: !variantInfo || !!variantInfo.installing,
        id: "add",
        label: "Add",
        onClick: async () => {
          if (await actions.installPackages([packageInfo.id])) {
            await actions.enablePackages([packageInfo.id])
          }
        },
      })

      packageActions.push({
        description: "Download this package without enabling it",
        disabled: !variantInfo || !!variantInfo.installing,
        id: "download",
        label: "Download",
        onClick: async () => {
          await actions.installPackages([packageInfo.id])
        },
      })
    }

    return packageActions
  }, [currentProfile, packageInfo, variant])

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
              onClick={event => {
                event.stopPropagation()
                mainAction.onClick()
              }}
              onMouseEnter={() => {
                if (onHover) {
                  onHover(true)
                }
              }}
              onMouseLeave={() => {
                if (onHover) {
                  onHover(false)
                }
              }}
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
              onClick={event => {
                event.stopPropagation()
                setMenuOpen(true)
                if (onMenuOpen) {
                  onMenuOpen()
                }

                if (onHover) {
                  setTimeout(() => onHover(true), 1)
                }
              }}
              onMouseEnter={() => {
                if (onHover) {
                  onHover(true)
                }
              }}
              onMouseLeave={() => {
                if (onHover) {
                  onHover(false)
                }
              }}
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
              onClose={() => {
                setMenuOpen(false)
                if (onHover) {
                  setTimeout(() => onHover(false), 1)
                }
              }}
              slotProps={{
                paper: {
                  onClick: event => event.stopPropagation(),
                  sx: { minWidth: anchorRef.current?.offsetWidth },
                },
              }}
            >
              {moreActions.map(action => (
                <Tooltip placement="left" key={action.id} title={action.description}>
                  <MenuItem
                    disabled={action.disabled}
                    onClick={() => {
                      action.onClick()
                      setMenuOpen(false)
                      if (onHover) {
                        setTimeout(() => onHover(false), 1)
                      }
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
      {Object.keys(packageInfo.variants).length > 1 && (
        <Select
          fullWidth
          MenuProps={{
            onClose: () => {
              setMenuOpen(false)
              if (onHover) {
                setTimeout(() => onHover(false), 1)
              }
            },
            sx: { maxHeight: 320 },
          }}
          name="variant"
          onChange={event => {
            event.preventDefault()
            actions.setPackageVariant(packageInfo.id, event.target.value)
          }}
          onMouseEnter={() => {
            if (onHover) {
              onHover(true)
            }
          }}
          onMouseLeave={() => {
            if (onHover) {
              onHover(false)
            }
          }}
          required
          size="small"
          value={variant}
          variant="outlined"
        >
          {Object.entries(packageInfo.variants).map(([id, variant]) => (
            <MenuItem key={id} value={id}>
              {variant!.name}
            </MenuItem>
          ))}
        </Select>
      )}
    </Box>
  )
}
