import { Alert, AlertProps, styled } from "@mui/material"

const Styled = styled(Alert)`
  align-items: center;
  height: 56px;
  margin-top: 16px;
  & .MuiAlert-message {
    display: -webkit-box;
    overflow: hidden;
    padding: 0;
    text-overflow: ellipsis;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
`

export function PackageListItemBanner({
  children,
  color,
  icon,
}: Pick<AlertProps, "children" | "color" | "icon">): JSX.Element {
  return (
    <Styled icon={icon} color={color} severity="warning">
      {children}
    </Styled>
  )
}
