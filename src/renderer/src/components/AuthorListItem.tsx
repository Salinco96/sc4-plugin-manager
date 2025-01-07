import { memo } from "react"

import type { AuthorID } from "@common/authors"
import { AuthorHeader } from "@components/AuthorHeader"
import { ListItem } from "@components/ListItem"

export const AuthorListItem = memo(function AuthorListItem(props: {
  isDisabled?: boolean
  authorId: AuthorID
}): JSX.Element {
  return <ListItem header={AuthorHeader} {...props} />
})
