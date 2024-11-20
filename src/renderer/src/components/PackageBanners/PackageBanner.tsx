import { Alert, type AlertProps, Button, styled } from "@mui/material"

export const PACKAGE_BANNER_HEIGHT = 56
export const PACKAGE_BANNER_SPACING = 16

const StyledAlert = styled(Alert)`
  align-items: center;
  height: ${PACKAGE_BANNER_HEIGHT}px;
  margin-top: ${PACKAGE_BANNER_SPACING}px;

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

export interface PackageBannerAction {
  description: string
  label: string
  onClick: () => void
}

export function PackageBanner({
  action,
  children,
  color,
  header,
  icon,
}: Pick<AlertProps, "children" | "color" | "icon"> & {
  action?: PackageBannerAction
  header?: string
}): JSX.Element {
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
      {header && <b>{header}: </b>}
      {children}
    </StyledAlert>
  )
}
