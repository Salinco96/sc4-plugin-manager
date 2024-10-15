import { CSSProperties, ComponentType, Ref, forwardRef, memo, useContext, useMemo } from "react"

import { Box, SxProps } from "@mui/material"
import AutoSizer from "react-virtualized-auto-sizer"
import { ListChildComponentProps, VariableSizeList } from "react-window"

import { createContext } from "@utils/context"

export interface VirtualListProps<T> {
  baseSize: number
  itemComponent: ComponentType<VirtualListItemProps<T>>
  items: unknown[]
  itemSize?: (item: T, baseSize: number) => number | undefined
  paddingBottom?: number
  paddingLeft?: number
  paddingRight?: number
  paddingTop?: number
  ref?: Ref<VariableSizeList<T>>
  spacing?: number
  sx?: SxProps
}

export interface VirtualListItemProps<T> {
  index: number
  item: T
}

interface VirtualListContext<T> {
  items: T[]
  paddingBottom: number
  paddingLeft: number
  paddingRight: number
  paddingTop: number
  spacing: number
}

const VirtualListContext = createContext<VirtualListContext<unknown>>("VirtualListContext", {
  items: [],
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
  paddingTop: 0,
  spacing: 0,
})

const innerElementType = forwardRef<HTMLUListElement, { style: CSSProperties }>(
  ({ style, ...props }, ref) => {
    const { paddingBottom, paddingTop, spacing } = useContext(VirtualListContext)

    return (
      <ul
        {...props}
        ref={ref}
        style={{
          ...style,
          height: (style.height as number) + paddingTop + paddingBottom - spacing,
          margin: 0,
          padding: 0,
        }}
      />
    )
  },
)

innerElementType.displayName = "VirtualListInner"

const rowElementType = memo(function VirtualListItem<T>({
  data: ItemComponent,
  index,
  style,
}: ListChildComponentProps<ComponentType<VirtualListItemProps<T>>>) {
  const { items, paddingLeft, paddingRight, paddingTop, spacing } = useContext(VirtualListContext)

  const item = items[index] as T

  return (
    <li
      style={{
        ...style,
        left: (style.left as number) + paddingLeft,
        listStyle: "none",
        height: (style.height as number) - spacing,
        right: paddingRight,
        top: (style.top as number) + paddingTop,
        width: undefined,
      }}
    >
      <ItemComponent index={index} item={item} />
    </li>
  )
})

const rootElementType = forwardRef<VariableSizeList, VirtualListProps<unknown>>(
  (
    {
      baseSize,
      itemComponent,
      items,
      itemSize,
      paddingBottom = 0,
      paddingLeft = 0,
      paddingRight = 0,
      paddingTop = 0,
      spacing = 0,
      sx,
    },
    ref,
  ) => {
    const context = useMemo(
      () => ({ items, paddingBottom, paddingLeft, paddingRight, paddingTop, spacing }),
      [items, paddingBottom, paddingLeft, paddingRight, paddingTop, spacing],
    )

    return (
      <Box sx={sx}>
        <VirtualListContext.Provider value={context}>
          <AutoSizer>
            {({ height, width }) => (
              <VariableSizeList
                estimatedItemSize={baseSize + spacing}
                height={height}
                innerElementType={innerElementType}
                itemCount={items.length}
                itemData={itemComponent}
                itemSize={index => (itemSize?.(items[index], baseSize) ?? baseSize) + spacing}
                ref={ref}
                width={width}
              >
                {rowElementType}
              </VariableSizeList>
            )}
          </AutoSizer>
        </VirtualListContext.Provider>
      </Box>
    )
  },
)

rootElementType.displayName = "VirtualList"

export const VirtualList = rootElementType as <T>(props: VirtualListProps<T>) => JSX.Element
