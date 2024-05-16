import { useMemo, useRef, useState } from "react"

import MoreOptionsIcon from "@mui/icons-material/MoreVert"
import Button from "@mui/material/Button"
import Divider from "@mui/material/Divider"
import Menu from "@mui/material/Menu"
import MenuItem from "@mui/material/MenuItem"
import Tooltip from "@mui/material/Tooltip"

import { PackageInfo } from "@common/types"
import { useCurrentProfile, useStore, useStoreActions } from "@renderer/utils/store"

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
  const info = useStore(store => store.remotePackages?.[packageInfo.id])

  const enabled = currentProfile?.packages[packageInfo.id]

  const packageActions = useMemo(() => {
    const packageActions: PackageAction[] = []

    if (packageInfo.installed) {
      if (packageInfo.installed !== packageInfo.version) {
        packageActions.push({
          color: "warning",
          description: `Update to version ${packageInfo.version}`,
          id: "update",
          label: "Update",
          onClick: async () => {
            await actions.installPackage(packageInfo.id)
          },
        })
      }

      if (currentProfile) {
        if (enabled) {
          packageActions.push({
            color: "error",
            id: "disable",
            label: "Disable",
            onClick: async () => {
              await actions.disablePackage(packageInfo.id)
            },
          })
        } else {
          packageActions.push({
            color: "success",
            id: "enable",
            label: "Enable",
            onClick: async () => {
              await actions.enablePackage(packageInfo.id)
            },
          })
        }
      }
    } else {
      packageActions.push({
        description: "Download and enable this package",
        disabled: packageInfo.installing,
        id: "add",
        label: "Add",
        onClick: async () => {
          await actions.installPackage(packageInfo.id)
          await actions.enablePackage(packageInfo.id)
        },
      })

      packageActions.push({
        description: "Download this package without enabling it",
        disabled: packageInfo.installing,
        id: "download",
        label: "Download",
        onClick: async () => {
          await actions.installPackage(packageInfo.id)
        },
      })
    }

    return packageActions
  }, [currentProfile, enabled, packageInfo.id, packageInfo.installed, packageInfo.installing])

  if (!info || !packageActions.length) {
    return null
  }

  const mainAction = packageActions[0]
  const hasMore = packageActions.length > 1 && !mainAction.disabled

  return (
    <>
      <Tooltip placement="left" title={mainAction.description}>
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
          sx={{
            height: 40,
            minWidth: 160,
            paddingRight: hasMore ? 5.5 : 2,
          }}
          variant="contained"
        >
          {mainAction.label}
        </Button>
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
            {packageActions.slice(1).map(action => (
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
    </>
  )
}
