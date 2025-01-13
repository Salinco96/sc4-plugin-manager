import type { ToolID } from "@common/tools"
import { FlexBox } from "@components/FlexBox"
import { List } from "@components/List"
import { useNavigation } from "@utils/navigation"

import { ToolListItem } from "./ToolListItem"

export function ToolList({ toolIds }: { toolIds: ToolID[] }): JSX.Element {
  const { fromToolId } = useNavigation()

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
