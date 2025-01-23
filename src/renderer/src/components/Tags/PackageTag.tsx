import { $removeFirst, remove } from "@salinco/nice-utils"

import { setPackageFilters } from "@stores/actions"
import { store } from "@stores/main"
import { Tag, type TagProps } from "./Tag"
import { TagType, type TagValue } from "./utils"

export function PackageTag(props: Omit<TagProps, "isSelected" | "onClick">): JSX.Element {
  const categories = store.useCategories()
  const filters = store.usePackageFilters()

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
          setPackageFilters({ [key]: remove(values, props.tag.value) })
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

          setPackageFilters({ [key]: newValues })
        }
      }}
    />
  )
}
