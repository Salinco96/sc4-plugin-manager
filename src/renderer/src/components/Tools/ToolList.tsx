import type { ToolID } from "@common/tools"
import { FlexCol } from "@components/FlexBox"
import { List } from "@components/List"
import { useNavigation } from "@utils/navigation"

import { ToolListItem } from "./ToolListItem"

export function ToolList({ toolIds }: { toolIds: ToolID[] }): JSX.Element {
  const { fromToolId } = useNavigation()

  return (
    <FlexCol fullHeight>
      <List
        items={toolIds}
        initialItem={fromToolId}
        renderItem={toolId => <ToolListItem toolId={toolId} />}
      />
    </FlexCol>
  )
}
