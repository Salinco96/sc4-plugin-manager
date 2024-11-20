import { useMemo } from "react"

import { Box } from "@mui/material"
import { Virtuoso } from "react-virtuoso"

import type { AuthorID } from "@common/authors"
import { Page, useHistory } from "@utils/navigation"

import { AuthorListItem } from "./AuthorListItem"
import { EmptyAuthorList } from "./EmptyAuthorList"

export function AuthorList({ authorIds }: { authorIds: AuthorID[] }): JSX.Element {
  const history = useHistory()

  const initialIndex = useMemo(() => {
    if (history.previous?.page === Page.AuthorView) {
      const index = authorIds.indexOf(history.previous.data.authorId)
      if (index >= 0) {
        return index
      }
    }

    return 0
  }, [authorIds, history])

  if (authorIds.length === 0) {
    return <EmptyAuthorList />
  }

  return (
    <Virtuoso
      data={authorIds}
      itemContent={(index, authorId) => (
        <Box padding={2} paddingTop={index === 0 ? 2 : 0}>
          <AuthorListItem authorId={authorId} />
        </Box>
      )}
      initialTopMostItemIndex={initialIndex}
      style={{ flex: 1, width: "100%" }}
    />
  )
}
