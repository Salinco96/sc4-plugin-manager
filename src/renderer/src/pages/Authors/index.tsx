import { useMemo } from "react"

import { Box } from "@mui/material"

import { keys } from "@common/utils/objects"
import { AuthorList } from "@components/AuthorList"
import { getAuthorName } from "@components/Tags" // TODO
import { useAuthors } from "@utils/store"

function Authors(): JSX.Element {
  const authors = useAuthors()

  const authorIds = useMemo(() => {
    return keys(authors).sort((a, b) =>
      getAuthorName(a, authors).localeCompare(getAuthorName(b, authors)),
    )
  }, [authors])

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AuthorList authorIds={authorIds} />
    </Box>
  )
}

export default Authors
