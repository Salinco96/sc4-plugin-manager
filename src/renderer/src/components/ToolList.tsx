import type { ToolID } from "@common/tools"
import { FlexBox } from "@components/FlexBox"
import { List } from "@components/List"
import { Page, useHistory } from "@utils/navigation"
import { useMemo } from "react"
import { ToolListItem } from "./ToolListItem"

export function ToolList({ toolIds }: { toolIds: ToolID[] }): JSX.Element {
  const history = useHistory()

  const fromToolId = useMemo(() => {
    if (history.previous?.page === Page.ToolView) {
      return history.previous.data.toolId
    }
  }, [history])

  return (
    <FlexBox direction="column" height="100%">
      <List
        items={toolIds}
        initialItem={fromToolId}
        renderItem={toolId => <ToolListItem toolId={toolId} />}
      />
    </FlexBox>
  )
}
