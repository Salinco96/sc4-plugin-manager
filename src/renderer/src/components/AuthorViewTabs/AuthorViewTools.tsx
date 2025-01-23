import { values } from "@salinco/nice-utils"
import { useMemo } from "react"

import type { AuthorID } from "@common/authors"
import { ToolList } from "@components/Tools/ToolList"
import { store } from "@stores/main"

export default function AuthorViewTools({ authorId }: { authorId: AuthorID }): JSX.Element {
  const tools = store.useTools()

  const toolIds = useMemo(() => {
    if (!tools) {
      return []
    }

    return values(tools)
      .filter(tool => !tool.disabled && tool.authors?.includes(authorId))
      .map(tool => tool.id)
  }, [authorId, tools])

  return <ToolList toolIds={toolIds} />
}
