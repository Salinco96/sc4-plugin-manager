import { MoreVert as MoreOptionsIcon } from "@mui/icons-material"
import { Button, Divider, Menu, MenuItem, Tooltip } from "@mui/material"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { FlexCol, FlexRow } from "./FlexBox"

export interface Action {
  action: () => void
  color?: "error" | "info" | "success" | "warning"
  description?: string
  disabled?: boolean
  id: string
  label: string
}

export function ActionButton({
  actions,
  isLoading,
  loadingLabel,
}: {
  actions: Action[]
  isLoading?: boolean
  loadingLabel?: string
}): JSX.Element | null {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [isMenuOpen, setMenuOpen] = useState(false)

  const { t } = useTranslation("General")

  if (!actions.length) {
    return null
  }

  const mainAction = actions[0]
  const moreActions = actions.slice(1).filter(action => !action.disabled)
  const hasMore = !!moreActions.length && !mainAction.disabled
  const disabled = !!mainAction.disabled || !!isLoading

  return (
    <FlexCol gap={2} width={160}>
      <FlexRow>
        <Tooltip placement="left" title={mainAction.description}>
          <span>
            <Button
              color={mainAction.color}
              disabled={disabled}
              onClick={mainAction.action}
              ref={anchorRef}
              sx={{ height: 40, paddingRight: hasMore ? 5.5 : 2, width: 160 }}
              variant="contained"
            >
              {loadingLabel ?? mainAction.label}
            </Button>
          </span>
        </Tooltip>

        {hasMore && (
          <FlexRow bgcolor="white" ml={-3.5} zIndex={1}>
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
                      action.action()
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
      </FlexRow>
    </FlexCol>
  )
}
