import { Alert, type AlertProps, AlertTitle, Button } from "@mui/material"
import type { ReactNode } from "react"

export interface BannerAction {
  description: string
  label: string
  onClick: () => void
}

export interface BannerProps {
  action?: BannerAction
  children: ReactNode
  color?: AlertProps["color"]
  compact?: boolean
  title?: string
  icon?: AlertProps["icon"]
}

export function Banner({
  action,
  children,
  color,
  compact,
  title,
  icon,
}: BannerProps): JSX.Element {
  return (
    <Alert
      action={
        action && (
          <Button
            aria-label={action.description}
            color="inherit"
            onClick={action.onClick}
            size={compact ? "small" : "medium"}
            title={action.description}
            variant="text"
          >
            {action.label}
          </Button>
        )
      }
      color={color}
      icon={icon}
      severity="warning"
      sx={{
        marginTop: compact ? 1 : 2,
        minHeight: compact ? 40 : 56,
        paddingY: 0,
        "& > .MuiAlert-action": {
          marginLeft: 1,
          marginY: compact ? "5px" : title ? "12px" : "10px",
          padding: 0,
        },
        "& > .MuiAlert-icon": {
          paddingY: compact ? "9px" : "17px",
        },
        "& > .MuiAlert-message": {
          alignSelf: "center",
          flex: "1 1 auto",
          overflow: "hidden",
          paddingY: 0.75,
          whiteSpace: "pre-wrap",
        },
      }}
    >
      {title && (
        <AlertTitle
          sx={{
            display: compact ? "inline" : undefined,
            fontSize: compact ? "inherit" : undefined,
            marginBottom: 0.5,
            marginTop: 0,
          }}
        >
          {title}
          {compact && ": "}
        </AlertTitle>
      )}

      {children}
    </Alert>
  )
}
