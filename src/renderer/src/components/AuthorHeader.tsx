import type { AuthorID } from "@common/authors"
import { Page } from "@utils/navigation"
import { useAuthors } from "@utils/store"
import { AuthorTools } from "./AuthorTools"
import { Header } from "./Header"
import { getAuthorName } from "./Tags/utils"

export function AuthorHeader({
  isListItem,
  setActive,
  authorId,
}: {
  isListItem?: boolean
  setActive?: (active: boolean) => void
  authorId: AuthorID
}): JSX.Element {
  const authors = useAuthors()
  const authorInfo = authors[authorId]

  return (
    <Header
      isListItem={isListItem}
      location={{ data: { authorId }, page: Page.AuthorView }}
      setActive={setActive}
      subtitle={authorId}
      thumbnail={authorInfo?.thumbnail}
      thumbnailSize="small"
      title={getAuthorName(authorId, authors)}
      tools={<AuthorTools authorId={authorId} />}
    />
  )
}
