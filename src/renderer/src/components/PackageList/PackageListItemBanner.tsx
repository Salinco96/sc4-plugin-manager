import { Alert, AlertProps, styled } from "@mui/material"

const Styled = styled(Alert)`
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

export function PackageListItemBanner(
  props: Pick<AlertProps, "action" | "children" | "color" | "icon">,
): JSX.Element {
  return <Styled severity="warning" {...props} />
}
