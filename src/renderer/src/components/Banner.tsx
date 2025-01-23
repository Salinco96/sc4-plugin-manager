import { Alert, type AlertProps, Button, styled } from "@mui/material"
import type { ReactNode } from "react"

const StyledAlert = styled(Alert)`
  align-items: center;
  height: 56px;
  margin-top: 16px;

  & .MuiAlert-action {
    margin-left: 8px;
    padding: 0;
  }

  & .MuiAlert-message {
    display: -webkit-box;
    flex: 1 1 auto;
    overflow: hidden;
    padding: 0;
    text-overflow: ellipsis;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
`

export interface BannerAction {
  description: string
  label: string
  onClick: () => void
}

export interface BannerProps {
  action?: BannerAction
  children: ReactNode
  color?: AlertProps["color"]
  title?: string
  icon?: AlertProps["icon"]
}

export function Banner({ action, children, color, title, icon }: BannerProps): JSX.Element {
  return (
    <StyledAlert
      action={
        action && (
          <Button
            aria-label={action.description}
            color="inherit"
            onClick={action.onClick}
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
    >
      {title && <b>{title}: </b>}
      {children}
    </StyledAlert>
  )
}
