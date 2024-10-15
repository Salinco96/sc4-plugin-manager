import { useCallback, useMemo, useRef, useState } from "react"

import { Box, Card, CardContent, Link } from "@mui/material"

import { AuthorID } from "@common/authors"
import { keys } from "@common/utils/objects"
import { AuthorTools } from "@components/AuthorTools"
import { FlexBox } from "@components/FlexBox"
import { EmptyPackageList } from "@components/PackageList/EmptyPackageList"
import { getAuthorName } from "@components/PackageList/utils"
import { VirtualList } from "@components/PackageList/VirtualList"
import { Text } from "@components/Text"
import { Thumbnail } from "@components/Thumbnail"
import { Page, useHistory } from "@utils/navigation"
import { useAuthors } from "@utils/store"

function AuthorListItem({ item: authorId }: { item: AuthorID }): JSX.Element {
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
          {author?.thumbnail && <Thumbnail mr={2} size={56} src={author.thumbnail} />}
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
}

function Authors(): JSX.Element {
  const authors = useAuthors()
  const history = useHistory()

  const scrolled = useRef(false)

  const authorIds = useMemo(() => {
    return keys(authors).sort((a, b) =>
      getAuthorName(a, authors).localeCompare(getAuthorName(b, authors)),
    )
  }, [authors])

  if (authorIds.length === 0) {
    // TODO: Authors
    return <EmptyPackageList />
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", padding: 2, gap: 2 }}>
      <VirtualList<AuthorID>
        baseSize={88}
        items={authorIds}
        itemComponent={AuthorListItem}
        paddingBottom={16}
        paddingLeft={16}
        paddingRight={16}
        paddingTop={16}
        ref={list => {
          list?.resetAfterIndex(0)

          // Scroll to package upon coming back from author view
          if (list && history.previous?.page === Page.AuthorView && !scrolled.current) {
            const fromAuthorId = history.previous.data.authorId
            const index = authorIds.indexOf(fromAuthorId)
            if (index >= 0) {
              list.scrollToItem(index, "start")
            }

            scrolled.current = true
          }
        }}
        spacing={16}
        sx={{ flex: 1, height: "100%" }}
      />
    </Box>
  )
}

export default Authors
