import { Box, Typography } from "@mui/material"

import type { AuthorID } from "@common/authors"
import { FlexBox } from "@components/FlexBox"
import { useAuthors } from "@utils/store"

import { AuthorTools } from "./AuthorTools"
import { getAuthorName } from "./Tags/utils"
import { Thumbnail } from "./Thumbnail"

export function AuthorHeader({ authorId }: { authorId: AuthorID }): JSX.Element {
  const authors = useAuthors()

  const authorInfo = authors[authorId]

  return (
    <FlexBox alignItems="center" pb={2} px={2}>
      {authorInfo?.thumbnail && <Thumbnail mr={2} round size={56} src={authorInfo.thumbnail} />}
      <Box flexGrow={1} pr={2}>
        <Typography variant="h6">{getAuthorName(authorId, authors)}</Typography>
        <FlexBox alignItems="center">
          <Typography variant="body2">{authorId}</Typography>
          <AuthorTools authorId={authorId} />
        </FlexBox>
      </Box>
    </FlexBox>
  )
}
