import { memo, useCallback, useState } from "react"

import type { AuthorID } from "@common/authors"
import { AuthorTools } from "@components/AuthorTools"
import { FlexBox } from "@components/FlexBox"
import { getAuthorName } from "@components/Tags/utils"
import { Text } from "@components/Text"
import { Thumbnail } from "@components/Thumbnail"
import { Card, CardContent, Link } from "@mui/material"
import { Page, useHistory } from "@utils/navigation"
import { useAuthors } from "@utils/store"

export const AuthorListItem = memo(function AuthorListItem({
  authorId,
}: {
  authorId: AuthorID
}): JSX.Element {
  const authors = useAuthors()
  const history = useHistory()

  const openAuthorView = useCallback(() => {
    history.push({ page: Page.AuthorView, data: { authorId } })
  }, [history, authorId])

  const [focus, setFocus] = useState(false)
  const [hover, setHover] = useState(false)

  const author = authors[authorId]

  const active = focus || hover

  return (
    <Card elevation={active ? 8 : 1} sx={{ display: "flex", height: "100%" }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <FlexBox direction="row">
          {author?.thumbnail && <Thumbnail mr={2} round size={56} src={author.thumbnail} />}
          <FlexBox direction="column">
            <Link
              color="inherit"
              onBlur={() => setFocus(false)}
              onClick={openAuthorView}
              onFocus={event => setFocus(event.target === event.currentTarget)}
              onKeyDown={event => event.key === "Enter" && openAuthorView()}
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              sx={{
                cursor: "pointer",
                display: "block",
                textDecoration: active ? "underline" : "unset",
                width: "fit-content",
              }}
              tabIndex={0}
            >
              <Text maxLines={1} variant="h6">
                {getAuthorName(authorId, authors)}
              </Text>
            </Link>
            <FlexBox alignItems="center">
              <Link
                color="inherit"
                onClick={openAuthorView}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                sx={{ cursor: "pointer", textDecoration: active ? "underline" : "unset" }}
              >
                <Text maxLines={1} variant="body2">
                  {authorId}
                </Text>
              </Link>
              <AuthorTools authorId={authorId} />
            </FlexBox>
          </FlexBox>
        </FlexBox>
      </CardContent>
    </Card>
  )
})
