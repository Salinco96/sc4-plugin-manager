import { useMemo } from "react"

import type { ToolID } from "@common/tools"
import { VariantState } from "@common/types"
import { Tags } from "@components/Tags/Tags"
import { type TagInfo, TagType, createTag } from "@components/Tags/utils"
import { store } from "@stores/main"

export function ToolTags({
  toolId,
}: {
  toolId: ToolID
}): JSX.Element | null {
  const toolInfo = store.useToolInfo(toolId)

  const tags = useMemo(() => {
    const tags: TagInfo[] = []

    if (toolInfo.authors) {
      for (const authorId of toolInfo.authors) {
        tags.push(createTag(TagType.AUTHOR, authorId))
      }
    }

    if (toolInfo.new) {
      tags.push(createTag(TagType.STATE, VariantState.NEW))
    }

    return tags
  }, [toolInfo])

  return <Tags tags={tags} />
}
