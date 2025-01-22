import { MoreVert as MoreOptionsIcon } from "@mui/icons-material"
import { Button, Divider, Menu, MenuItem, Select, Tooltip } from "@mui/material"
import { type ComponentType, type ReactNode, useRef, useState } from "react"
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

export interface Variant<VariantID extends string> {
  description?: string
  disabled?: boolean
  icon?: ComponentType<{ fontSize: "inherit" }>
  id: VariantID
  label: ReactNode
}

export function ActionButton<VariantID extends string>({
  actions,
  isLoading,
  loadingLabel,
  variant,
  variants,
  setVariant,
}: {
  actions: Array<Action | false | null | undefined>
  isLoading?: boolean
  loadingLabel?: string
  variant?: VariantID
  variants?: Array<Variant<VariantID> | false | null | undefined>
  setVariant?: (variant: VariantID) => void
}): JSX.Element | null {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [isMenuOpen, setMenuOpen] = useState(false)

  const { t } = useTranslation("General")

  const filteredActions = actions.filter(action => !!action)
  const mainAction = filteredActions.find(action => !action.disabled) ?? filteredActions.at(0)
  const moreActions = filteredActions.filter(action => action !== mainAction && !action.disabled)
  const hasMore = !!moreActions.length && !mainAction?.disabled
  const disabled = !!mainAction?.disabled || !!isLoading

  const filteredVariants = variants?.filter(variant => !!variant)
  const selectableVariants = filteredVariants
    ?.filter(variant => !variant.disabled)
    .map(variant => variant.id)

  if (!mainAction && !filteredVariants?.length) {
    return null
  }

  return (
    <FlexCol gap={2} width={160}>
      {mainAction && (
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
      )}

      {!!filteredVariants?.length && (
        <Select
          disabled={
            selectableVariants?.length === 0 ||
            (selectableVariants?.length === 1 && variant === selectableVariants[0]) ||
            !setVariant
          }
          error={!variant || !selectableVariants?.includes(variant)}
          fullWidth
          onClose={() => setMenuOpen(false)}
          MenuProps={{ sx: { maxHeight: 320 } }}
          name="variant"
          onChange={event => setVariant?.(event.target.value as VariantID)}
          required
          size="small"
          value={variant ?? ""}
          variant="outlined"
        >
          {filteredVariants.map(({ description, disabled, icon: IconComponent, id, label }) => (
            <MenuItem key={id} value={id} disabled={disabled}>
              <FlexRow centered fullWidth gap={1} title={description}>
                {label}
                {IconComponent && <IconComponent fontSize="inherit" />}
              </FlexRow>
            </MenuItem>
          ))}
        </Select>
      )}
    </FlexCol>
  )
}
