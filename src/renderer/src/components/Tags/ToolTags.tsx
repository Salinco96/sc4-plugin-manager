import type { ToolID } from "@common/tools"
import { useToolInfo } from "@utils/packages"
import { Tags } from "./Tags"
import { TagType, createTag } from "./utils"

export function ToolTags({
  toolId,
}: {
  toolId: ToolID
}): JSX.Element | null {
  const toolInfo = useToolInfo(toolId)

  const tags = toolInfo.authors?.map(authorId => createTag(TagType.AUTHOR, authorId)) ?? []

  return <Tags tags={tags} />
}
