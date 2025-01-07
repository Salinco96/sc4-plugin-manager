import type { ToolID } from "@common/tools"
import { ToolHeader } from "@components/ToolHeader"
import { memo } from "react"
import { ListItem } from "./ListItem"

export const ToolListItem = memo(function ToolListItem(props: {
  isDisabled?: boolean
  toolId: ToolID
}): JSX.Element {
  return <ListItem header={ToolHeader} {...props} />
})
