import { Box } from "@mui/material"
import { Virtuoso } from "react-virtuoso"

import { Empty } from "./Empty"

export function List<T>({
  emptyMessage,
  initialItem,
  items,
  renderItem,
}: {
  emptyMessage?: string
  initialItem?: T
  items: T[]
  renderItem: (item: T) => JSX.Element
}): JSX.Element {
  if (items.length === 0) {
    return <Empty message={emptyMessage} />
  }

  const initialIndex = initialItem !== undefined ? items.indexOf(initialItem) : 0

  return (
    <Virtuoso
      data={items}
      itemContent={(index, item) => (
        <Box padding={2} paddingTop={index === 0 ? 2 : 0}>
          {renderItem(item)}
        </Box>
      )}
      initialTopMostItemIndex={{ align: "center", index: initialIndex >= 0 ? initialIndex : 0 }}
      style={{ flex: 1, width: "100%" }}
    />
  )
}
