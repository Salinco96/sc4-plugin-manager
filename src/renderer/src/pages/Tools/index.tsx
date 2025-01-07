import { sortBy, values } from "@salinco/nice-utils"

import { Loader } from "@components/Loader"
import { ToolList } from "@components/ToolList"
import { useStore } from "@utils/store"

function Tools(): JSX.Element {
  const tools = useStore(store => store.tools)

  if (!tools) {
    return <Loader />
  }

  const toolIds = sortBy(
    values(tools).filter(tool => !tool.disabled),
    tool => tool.name ?? tool.id,
  ).map(tool => tool.id)

  return <ToolList toolIds={toolIds} />
}

export default Tools
