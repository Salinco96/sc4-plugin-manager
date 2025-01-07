import { Box } from "@mui/material"
import { sortBy, values } from "@salinco/nice-utils"
import { useMemo } from "react"
import { Virtuoso } from "react-virtuoso"

import { Loader } from "@components/Loader"
import { ToolListItem } from "@components/ToolList/ToolListItem"
import { Page, useHistory } from "@utils/navigation"
import { useStore } from "@utils/store"

function Tools(): JSX.Element {
  const history = useHistory()
  const tools = useStore(store => store.tools)

  const toolIds = sortBy(
    values(tools ?? {}).filter(tool => !tool.disabled),
    tool => tool.name ?? tool.id,
  ).map(tool => tool.id)

  const initialIndex = useMemo(() => {
    if (history.previous?.page === Page.ToolView) {
      const index = toolIds.indexOf(history.previous.data.toolId)
      if (index >= 0) {
        return index
      }
    }

    return 0
  }, [history, toolIds])

  if (!tools) {
    return <Loader />
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Virtuoso
        data={toolIds}
        itemContent={(index, id) => (
          <Box padding={2} paddingTop={index === 0 ? 2 : 0}>
            <ToolListItem toolId={id} />
          </Box>
        )}
        initialTopMostItemIndex={initialIndex}
        style={{ flex: 1, width: "100%" }}
      />
    </Box>
  )
}

export default Tools
