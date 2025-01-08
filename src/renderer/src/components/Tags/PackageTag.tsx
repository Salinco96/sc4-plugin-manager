import { usePackageFilters, useStore, useStoreActions } from "@utils/store"

import { $removeFirst, remove } from "@salinco/nice-utils"
import { Tag, type TagProps } from "./Tag"
import { TagType, type TagValue } from "./utils"

export function PackageTag(props: Omit<TagProps, "isSelected" | "onClick">): JSX.Element {
  const actions = useStoreActions()
  const categories = useStore(store => store.categories)
  const filters = usePackageFilters()

  const key = {
    author: "authors" as const,
    category: "categories" as const,
    state: "states" as const,
  }[props.tag.type]

  const values: TagValue<TagType>[] = filters[key]

  const isSelected = values.includes(props.tag.value)

  return (
    <Tag
      {...props}
      isSelected={isSelected}
      onClick={() => {
        if (values.includes(props.tag.value)) {
          actions.setPackageFilters({ [key]: remove(values, props.tag.value) })
        } else {
          // TODO: Awkward logic
          const newValues = [...values, props.tag.value]
          if (props.tag.type === TagType.CATEGORY) {
            let category = categories[props.tag.value]?.parent
            while (category) {
              $removeFirst(newValues, category)
              category = categories[category]?.parent
            }
          }

          actions.setPackageFilters({ [key]: newValues })
        }
      }}
    />
  )
}
