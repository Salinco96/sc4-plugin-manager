import type { ToolID } from "@common/tools"
import { memo } from "react"
import { ListItem } from "../ListItem"
import { ToolHeader } from "./ToolHeader"

export const ToolListItem = memo(function ToolListItem(props: {
  isDisabled?: boolean
  toolId: ToolID
}): JSX.Element {
  return <ListItem header={ToolHeader} {...props} />
})
