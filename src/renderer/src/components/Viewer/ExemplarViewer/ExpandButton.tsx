import { ExpandLess as CollapseIcon, ExpandMore as ExpandIcon } from "@mui/icons-material"
import { IconButton } from "@mui/material"

export interface ExpandButtonProps {
  isExpanded: boolean
  setExpanded: (isExpanded: boolean) => void
}

export function ExpandButton({ isExpanded, setExpanded }: ExpandButtonProps): JSX.Element {
  const Icon = isExpanded ? CollapseIcon : ExpandIcon

  return (
    <IconButton
      onClick={event => {
        setExpanded(!isExpanded)
        event.preventDefault()
        event.stopPropagation()
      }}
      size="small"
      title="Copy to clipboard"
    >
      <Icon fontSize="inherit" />
    </IconButton>
  )
}
